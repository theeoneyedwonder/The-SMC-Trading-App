from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
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


class Deal(Base):
    """Closed-trade deal history, mirrored from MT5 and persisted locally so
    the account history survives even after MT5's own history window rolls off."""
    __tablename__ = "deals"

    id          = Column(Integer, primary_key=True, index=True)
    ticket      = Column(Integer, unique=True, index=True)   # MT5 deal ticket
    position_id = Column(Integer, index=True)
    order_id    = Column(Integer)
    login       = Column(Integer, index=True)                # account login (scopes per-account)
    time        = Column(Integer, index=True)                # unix seconds (broker server time)
    symbol      = Column(String, index=True)
    direction   = Column(String)                             # BUY / SELL
    entry_type  = Column(String)                             # IN / OUT / INOUT / OUT_BY
    volume      = Column(Float)
    price       = Column(Float)
    profit      = Column(Float)
    commission  = Column(Float)
    swap        = Column(Float)

    def __repr__(self):
        return f"<Deal #{self.ticket} {self.symbol} {self.direction} {self.profit}>"


class ChatMessage(Base):
    """Sage's persistent conversation memory — survives reloads/restarts so
    Sage remembers prior discussion. Scoped per account login."""
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    login      = Column(Integer, index=True)     # account login (0 if unknown)
    role       = Column(String)                  # 'user' | 'assistant'
    content    = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<ChatMessage {self.role} #{self.id}>"


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