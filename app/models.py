from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Time, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime
import enum

class BookingStatus(str, enum.Enum):
    WAITING = "waiting"
    SERVED = "served"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"
    HALTED = "halted"  # new status for halted bookings

class Farmer(Base):
    __tablename__ = "farmers"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    village = Column(String, nullable=True)
    crop = Column(String, nullable=True)

    bookings = relationship("Booking", back_populates="farmer")
    notifications = relationship("Notification", back_populates="farmer")

class Slot(Base):
    __tablename__ = "slots"
    __table_args__ = (UniqueConstraint('date', 'start_time', 'end_time', name='uq_slot_time'),)
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    capacity = Column(Integer, nullable=False)
    booked_count = Column(Integer, default=0, nullable=False)

    bookings = relationship("Booking", back_populates="slot")

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String, unique=True, index=True, nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("slots.id"), nullable=False)
    status = Column(String, default=BookingStatus.WAITING.value) # waiting, served, no_show, rescheduled
    created_at = Column(DateTime, default=datetime.utcnow)

    farmer = relationship("Farmer", back_populates="bookings")
    slot = relationship("Slot", back_populates="bookings")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, default="queued") # queued, sent, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    farmer = relationship("Farmer", back_populates="notifications")
