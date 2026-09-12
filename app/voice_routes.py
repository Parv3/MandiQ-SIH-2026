import os
import base64
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal

from .services.sarvam_service import sarvam_client
from .services.bhashini_service import bhashini_client
from . import nlp_matcher

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    provider: Optional[Literal["sarvam", "bhashini", "auto"]] = "auto"
    language: Optional[str] = "hi-IN"
    speaker: Optional[str] = "priya"
    pace: Optional[float] = 1.0

class TranslateRequest(BaseModel):
    text: str
    source_language: Optional[str] = "en"
    target_language: Optional[str] = "hi"
    provider: Optional[Literal["sarvam", "bhashini", "auto"]] = "auto"

class ProcessSpeechRequest(BaseModel):
    transcript: Optional[str] = None
    audio_base64: Optional[str] = None
    provider: Optional[Literal["sarvam", "bhashini", "auto"]] = "auto"
    language: Optional[str] = "hi-IN"

@router.get("/providers")
async def get_providers_status():
    """
    Check live connection status and credentials for Sarvam AI and Bhashini.
    """
    return {
        "sarvam": {
            "configured": sarvam_client.is_configured,
            "models": {
                "tts": "bulbul:v1 (Indic Neural Voice)",
                "stt": "saarika:v1 (Rural Dialect STT)",
                "translation": "mayura:v1 (Indic Translation)"
            }
        },
        "bhashini": {
            "configured": bhashini_client.is_configured,
            "pipeline": "National Language Translation Mission (ULCA/Dhruva)",
            "services": ["ASR (Speech-to-Text)", "NMT (Translation)", "TTS (Text-to-Speech)"]
        }
    }

@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """
    Generate authentic Indic voice audio using Sarvam Bulbul or Bhashini TTS.
    """
    provider = req.provider

    # If set to auto, prioritize Sarvam then Bhashini
    if provider == "auto":
        provider = "sarvam" if sarvam_client.is_configured else ("bhashini" if bhashini_client.is_configured else "sarvam")

    if provider == "sarvam":
        lang_code = req.language if "-" in req.language else f"{req.language}-IN"
        result = await sarvam_client.text_to_speech(
            text=req.text,
            target_language_code=lang_code,
            speaker=req.speaker or "priya",
            pace=req.pace or 1.0
        )
        if result.get("success"):
            return result

        # Fallback to Bhashini if Sarvam fails
        if bhashini_client.is_configured:
            bhashini_res = await bhashini_client.text_to_speech(text=req.text, source_language=req.language.split("-")[0])
            if bhashini_res.get("success"):
                return bhashini_res

        return result

    elif provider == "bhashini":
        lang_code = req.language.split("-")[0]
        result = await bhashini_client.text_to_speech(
            text=req.text,
            source_language=lang_code,
            gender="female"
        )
        if result.get("success"):
            return result

        if sarvam_client.is_configured:
            return await sarvam_client.text_to_speech(text=req.text, target_language_code=f"{lang_code}-IN")

        return result

    raise HTTPException(status_code=400, detail=f"Unsupported provider: {req.provider}")

@router.post("/stt")
async def speech_to_text(
    file: Optional[UploadFile] = File(None),
    audio_base64: Optional[str] = Form(None),
    provider: Optional[str] = Form("auto"),
    language: Optional[str] = Form("hi-IN")
):
    """
    Transcribe spoken farmer audio via Sarvam Saarika:v1 or Bhashini ASR.
    Accepts either an uploaded audio file or base64-encoded audio.
    """
    audio_bytes = b""
    if file:
        audio_bytes = await file.read()
    elif audio_base64:
        # Strip data URL prefix if present (e.g. data:audio/wav;base64,...)
        if "," in audio_base64:
            audio_base64 = audio_base64.split(",")[1]
        audio_bytes = base64.b64decode(audio_base64)
    else:
        raise HTTPException(status_code=400, detail="Either 'file' or 'audio_base64' is required.")

    chosen_provider = provider
    if chosen_provider == "auto":
        chosen_provider = "sarvam" if sarvam_client.is_configured else "bhashini"

    if chosen_provider == "sarvam":
        lang_code = language if "-" in language else f"{language}-IN"
        result = await sarvam_client.speech_to_text(
            audio_bytes=audio_bytes,
            filename=file.filename if file else "voice_input.wav",
            language_code=lang_code
        )
        return result
    else:
        lang_code = language.split("-")[0]
        b64_str = base64.b64encode(audio_bytes).decode("utf-8")
        result = await bhashini_client.speech_to_text(
            audio_base64=b64_str,
            source_language=lang_code
        )
        return result

@router.post("/process-speech")
async def process_farmer_speech(req: ProcessSpeechRequest):
    """
    Unified voice AI pipeline for MandiQ:
    1. Transcribes audio via Sarvam or Bhashini (if raw audio is provided).
    2. Runs MandiQ NLP entity matcher on transcript to extract Crop and Village.
    3. Returns parsed farmer intent ready for one-click slot booking!
    """
    transcript = req.transcript or ""

    # If audio is provided, run STT first
    if req.audio_base64:
        clean_b64 = req.audio_base64.split(",")[1] if "," in req.audio_base64 else req.audio_base64
        audio_bytes = base64.b64decode(clean_b64)
        
        stt_res = await sarvam_client.speech_to_text(
            audio_bytes=audio_bytes,
            filename="farmer_speech.wav",
            language_code=req.language or "hi-IN"
        )
        if stt_res.get("success"):
            transcript = stt_res.get("transcript", "")
        elif bhashini_client.is_configured:
            b_res = await bhashini_client.speech_to_text(
                audio_base64=clean_b64,
                source_language=req.language.split("-")[0] if req.language else "hi"
            )
            if b_res.get("success"):
                transcript = b_res.get("transcript", "")

    # Extract crop and village from transcript
    extracted_crop = nlp_matcher.extract_crop(transcript)
    extracted_village = nlp_matcher.extract_village(transcript)

    return {
        "transcript": transcript,
        "extracted_crop": extracted_crop,
        "extracted_village": extracted_village,
        "intent": "book_slot" if extracted_crop else "unknown",
        "confidence": 0.95 if (extracted_crop and extracted_village) else (0.85 if extracted_crop else 0.5)
    }

@router.post("/translate")
async def translate_text(req: TranslateRequest):
    """
    Translate notifications or prompts between English and Indic languages.
    """
    provider = req.provider
    if provider == "auto":
        provider = "sarvam" if sarvam_client.is_configured else "bhashini"

    if provider == "sarvam":
        src = f"{req.source_language}-IN" if "-" not in req.source_language else req.source_language
        tgt = f"{req.target_language}-IN" if "-" not in req.target_language else req.target_language
        return await sarvam_client.translate(
            input_text=req.text,
            source_language_code=src,
            target_language_code=tgt
        )
    else:
        return await bhashini_client.translate(
            text=req.text,
            source_language=req.source_language.split("-")[0],
            target_language=req.target_language.split("-")[0]
        )
