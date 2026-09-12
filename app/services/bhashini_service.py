import os
import httpx
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BHASHINI_PIPELINE_URL = os.getenv(
    "BHASHINI_PIPELINE_URL", 
    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
)

class BhashiniService:
    def __init__(
        self,
        user_id: Optional[str] = None,
        api_key: Optional[str] = None,
        pipeline_url: Optional[str] = None
    ):
        self._user_id = user_id
        self._api_key = api_key
        self.pipeline_url = pipeline_url or BHASHINI_PIPELINE_URL

    @property
    def user_id(self) -> str:
        return (self._user_id or os.getenv("BHASHINI_USER_ID", "")).strip() or "abhishek.goswami_cs.aiml25@gla.ac.in"

    @property
    def api_key(self) -> str:
        return (self._api_key or os.getenv("BHASHINI_API_KEY", "")).strip() or "0869b29edc-2fb4-44d2-851a-4f073abaecac"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.user_id)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": self.api_key.strip(),
            "User-ID": self.user_id.strip(),
            "ulcaApiKey": self.api_key.strip(),
            "Content-Type": "application/json"
        }

    async def translate(
        self,
        text: str,
        source_language: str = "en",
        target_language: str = "hi"
    ) -> Dict[str, Any]:
        """
        Bhashini NMT (Neural Machine Translation)
        Translates text between English and Indian regional languages (Hindi, Punjabi, etc.)
        """
        if not self.is_configured:
            return {
                "success": False,
                "translated_text": text,
                "provider": "bhashini",
                "message": "BHASHINI credentials not configured."
            }

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language,
                            "targetLanguage": target_language
                        }
                    }
                }
            ],
            "inputData": {
                "input": [{"source": text}]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(self.pipeline_url, json=payload, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json()
                    pipeline_response = data.get("pipelineResponse", [])
                    if pipeline_response:
                        output = pipeline_response[0].get("output", [])
                        if output:
                            translated = output[0].get("target", text)
                            return {
                                "success": True,
                                "translated_text": translated,
                                "source_language": source_language,
                                "target_language": target_language,
                                "provider": "bhashini"
                            }
                    return {"success": False, "translated_text": text, "provider": "bhashini"}
                else:
                    logger.error(f"Bhashini Translation Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "translated_text": text,
                        "provider": "bhashini",
                        "error": f"Bhashini error: {res.status_code}",
                        "details": res.text
                    }
        except Exception as e:
            logger.exception("Error calling Bhashini translation")
            return {
                "success": False,
                "translated_text": text,
                "provider": "bhashini",
                "error": str(e)
            }

    async def text_to_speech(
        self,
        text: str,
        source_language: str = "hi",
        gender: str = "female"
    ) -> Dict[str, Any]:
        """
        Bhashini TTS (Text-to-Speech)
        Generates Indic speech audio base64 from text.
        """
        if not self.is_configured:
            return {
                "success": False,
                "audio_base64": None,
                "provider": "bhashini",
                "message": "BHASHINI credentials not configured."
            }

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language
                        },
                        "gender": gender
                    }
                }
            ],
            "inputData": {
                "input": [{"source": text}]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(self.pipeline_url, json=payload, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json()
                    pipeline_response = data.get("pipelineResponse", [])
                    if pipeline_response:
                        audio_list = pipeline_response[0].get("audio", [])
                        if audio_list:
                            audio_content = audio_list[0].get("audioContent", None)
                            return {
                                "success": True,
                                "audio_base64": audio_content,
                                "audio_format": "audio/wav",
                                "provider": "bhashini",
                                "language": source_language
                            }
                    return {"success": False, "audio_base64": None, "provider": "bhashini"}
                else:
                    logger.error(f"Bhashini TTS Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "audio_base64": None,
                        "provider": "bhashini",
                        "error": f"Bhashini status {res.status_code}",
                        "details": res.text
                    }
        except Exception as e:
            logger.exception("Error calling Bhashini TTS")
            return {
                "success": False,
                "audio_base64": None,
                "provider": "bhashini",
                "error": str(e)
            }

    async def speech_to_text(
        self,
        audio_base64: str,
        source_language: str = "hi"
    ) -> Dict[str, Any]:
        """
        Bhashini ASR (Automatic Speech Recognition)
        Transcribes base64-encoded Indic speech audio to text.
        """
        if not self.is_configured:
            return {
                "success": False,
                "transcript": "",
                "provider": "bhashini",
                "message": "BHASHINI credentials not configured."
            }

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language
                        }
                    }
                }
            ],
            "inputData": {
                "audio": [{"audioContent": audio_base64}]
            }
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(self.pipeline_url, json=payload, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json()
                    pipeline_response = data.get("pipelineResponse", [])
                    if pipeline_response:
                        output = pipeline_response[0].get("output", [])
                        if output:
                            transcript = output[0].get("source", "")
                            return {
                                "success": True,
                                "transcript": transcript,
                                "provider": "bhashini",
                                "language": source_language
                            }
                    return {"success": False, "transcript": "", "provider": "bhashini"}
                else:
                    logger.error(f"Bhashini ASR Error ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "transcript": "",
                        "provider": "bhashini",
                        "error": f"Bhashini status {res.status_code}",
                        "details": res.text
                    }
        except Exception as e:
            logger.exception("Error calling Bhashini ASR")
            return {
                "success": False,
                "transcript": "",
                "provider": "bhashini",
                "error": str(e)
            }

bhashini_client = BhashiniService()
