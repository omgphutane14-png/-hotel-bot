const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let roomsData = JSON.parse(fs.readFileSync('./rooms.json', 'utf8'));
let bookings = [];

// Home - Bot Status
app.get('/', (req, res) => {
  res.send(`
    <h1>🏨 ${roomsData.hotelName} - Bot LIVE</h1>
    <p>Bot Working! Endpoints:</p>
    <ul>
      <li>GET /api/rooms - All rooms</li>
      <li>POST /api/book - Book room</li>
      <li>POST /api/check - Check availability</li>
      <li>GET /api/bookings - All bookings</li>
      <li>POST /webhook - Chatbot webhook</li>
    </ul>
  `);
});

// Get all rooms
app.get('/api/rooms', (req, res) => {
  res.json(roomsData.rooms);
});

// Check availability
app.post('/api/check', (req, res) => {
  const { type, checkIn, checkOut } = req.body;
  const room = roomsData.rooms.find(r => r.type.toLowerCase() === type.toLowerCase());
  if (!room) return res.json({ status: 'error', message: 'Room type not found' });
  res.json({ status: 'success', available: room.available, room });
});

// Book room - Main Feature
app.post('/api/book', (req, res) => {
  const { name, phone, roomType, checkIn, checkOut, guests } = req.body;
  if (!name ||!phone ||!roomType) {
    return res.json({ status: 'error', message: 'Name, phone, roomType required' });
  }
  const room = roomsData.rooms.find(r => r.type.toLowerCase() === roomType.toLowerCase());
  if (!room || room.available <= 0) {
    return res.json({ status: 'error', message: 'Room not available' });
  }
  const bookingId = 'HTL' + Date.now();
  const booking = { bookingId, name, phone, roomType, checkIn, checkOut, guests, price: room.price, status: 'Confirmed', createdAt: new Date() };
  bookings.push(booking);
  room.available -= 1;
  res.json({ status: 'success', message: `Booking Confirmed! ID: ${bookingId}`, booking });
});

// Get all bookings
app.get('/api/bookings', (req, res) => {
  res.json(bookings);
});

// Cancel booking
app.post('/api/cancel', (req, res) => {
  const { bookingId } = req.body;
  const index = bookings.findIndex(b => b.bookingId === bookingId);
  if (index === -1) return res.json({ status: 'error', message: 'Booking not found' });
  const room = roomsData.rooms.find(r => r.type.toLowerCase() === bookings[index].roomType.toLowerCase());
  if (room) room.available += 1;
  bookings[index].status = 'Cancelled';
  res.json({ status: 'success', message: 'Booking Cancelled' });
});

// Chatbot Webhook - For WhatsApp/Telegram/Website Chat
app.post('/webhook', (req, res) => {
  const userMsg = (req.body.message || req.body.text || '').toLowerCase();
  let reply = '';

  if (userMsg.includes('hi') || userMsg.includes('hello')) {
    reply = `Welcome to ${roomsData.hotelName}! 🏨\n1. Rooms & Prices\n2. Book Room\n3. Check Availability\n4. Amenities\n5. Contact Us\nType number or keyword.`;
  } else if (userMsg.includes('1') || userMsg.includes('price') || userMsg.includes('room')) {
    reply = roomsData.rooms.map(r => `🏨 ${r.type}: ₹${r.price}/night - ${r.available} available - ${r.amenities.join(', ')}`).join('\n');
  } else if (userMsg.includes('2') || userMsg.includes('book')) {
    reply = `To book, send details:\nBOOK - Name, Phone, RoomType, CheckIn, Guests\nExample: BOOK - Rahul, 9876543210, Deluxe, 25-09-2026, 2`;
  } else if (userMsg.includes('contact') || userMsg.includes('5')) {
    reply = `📞 ${roomsData.contact.phone}\n📧 ${roomsData.contact.email}\n📍 ${roomsData.contact.address}`;
  } else if (userMsg.includes('cancel')) {
    reply = `To cancel: CANCEL - BookingID\nExample: CANCEL - HTL123456`;
  } else {
    reply = `I didn't understand. Type:\n1 for Rooms\n2 for Booking\n3 for Availability\n4 for Contact`;
  }

  res.json({ reply });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Hotel Bot Running on ${PORT}`));
