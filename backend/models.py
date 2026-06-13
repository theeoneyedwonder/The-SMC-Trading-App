from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class Trade(Base):
    __tablename__ = "trades"

    id         = Column(Integer, primary_key=True, index=True)
    ticket     = Column(Integer, unique=True, index=True)
    symbol     = Column(String, default="XAUUSDm")
    direction  = Column(String)           # "BUY" or "SELL"
    entry      = Column(Float)
    sl         = Column(Float)
    tp         = Column(Float)
    lot_size   = Column(Float)
    is_open    = Column(Boolean, default=True)
    open_time  = Column(DateTime, server_default=func.now())
    close_time = Column(DateTime, nullable=True)
    close_price= Column(Float, nullable=True)
    profit     = Column(Float, nullable=True)

    def __repr__(self):
        return f"<Trade #{self.ticket} {self.direction} @ {self.entry} | open={self.is_open}>"


class DetectedStructure(Base):
    __tablename__ = "structures"

    id         = Column(Integer, primary_key=True, index=True)
    timeframe  = Column(String)
    kind       = Column(String)           # "BOS", "MSS", "OB", "FVG"
    direction  = Column(String)           # "BULLISH" or "BEARISH"
    price_high = Column(Float)
    price_low  = Column(Float)
    bar_index  = Column(Integer)
    is_valid   = Column(Boolean, default=True)
    detected_at= Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Structure {self.kind} {self.direction} on {self.timeframe}>"