from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from . import models

async def queue_sms_notification(db: AsyncSession, farmer_id: int, message: str):
    """
    Queue an SMS message for a farmer. This writes to the notifications table.
    The actual sending would be handled by a background worker or chron job
    to avoid blocking the API response and to handle retries.
    """
    notification = models.Notification(
        farmer_id=farmer_id,
        message=message,
        status="queued"
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification

async def process_queued_notifications(db: AsyncSession):
    """
    This function simulates a background job processing queued SMS.
    In a real app, you might use Celery or APScheduler.
    """
    result = await db.execute(
        select(models.Notification).where(models.Notification.status == "queued")
    )
    notifications = result.scalars().all()
    
    for notif in notifications:
        # SIMULATE: Send SMS via DLT/Twilio/Exotel
        # print(f"Sending SMS to Farmer ID {notif.farmer_id}: {notif.message}")
        
        # Mark as sent
        notif.status = "sent"
        
    if notifications:
        await db.commit()
