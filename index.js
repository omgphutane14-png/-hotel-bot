const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const roomsData = require('./rooms.json');
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const MANAGER_NUMBER = process.env.MANAGER_NUMBER || '919834309809';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hotel123';
let orders = {};

app.get('/', function(req,res){
  var html = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hotel Chatbot - Bot LIVE</title>
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
<style>body{background:#0a1931;color:white}.gold{color:#d4af37}.card{background:#132a54;border:1px solid #d4af37;border-radius:12px}</style>
</head>
<body class="p-4 md:p-8">
<div class="flex justify-between items-center mb-8">
<h1 class="text-3xl font-bold"><span class="gold">🤖 Hotel Chatbot</span><br><span class="text-sm text-blue-200">WhatsApp Ordering System</span></h1>
<div class="bg-green-500 px-4 py-1 rounded-full font-bold">LIVE</div>
</div>
<h2 class="text-2xl font-bold mb-4">Dashboard Overview</h2>
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
<div class="card p-4"><p class="text-blue-200">Bot Status</p><p class="text-xl font-bold gold">LIVE & Active</p><p class="text-xs text-green-400">Uptime 99.9%</p></div>
<div class="card p-4"><p class="text-blue-200">Today Orders</p><p class="text-xl font-bold">`+Object.keys(orders).length+` Orders</p></div>
<div class="card p-4"><p class="text-blue-200">Revenue Today</p><p class="text-xl font-bold gold">₹28,450</p></div>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
<div class="card p-6 md:col-span-2">
<h3 class="font-bold text-lg mb-2">QR Code Generator</h3>
<p class="text-sm mb-3">Select Table: <select id="tableNo" class="text-black p-2 rounded"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
<button onclick="genQR()" class="bg-yellow-500 text-black font-bold px-4 py-2 rounded ml-2">Generate QR</button></p>
<div id="qrResult" class="bg-white p-2 rounded inline-block"><img id="previewQR" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://wa.me/919834309809?text=Hi%20Table%204" /></div>
<p class="text-xs mt-3 text-blue-200">Scan QR -> WhatsApp Hi Table -> Location -> Menu</p>
</div>
<div class="space-y-4">
<div class="card p-4"><h3 class="gold font-bold">Manager Panel</h3><a href="/manager" class="block mt-3 bg-yellow-500 text-black text-center py-2 rounded font-bold">Open Manager</a></div>
<div class="card p-4"><h3 class="gold font-bold">Chef Panel</h3><a href="/chef" class="block mt-3 border border-yellow-500 text-center py-2 rounded font-bold gold">Open Chef</a></div>
</div>
</div>
<footer class="text-center text-xs text-blue-200 mt-10 border-t border-yellow-600 pt-4">Hotel Chatbot - WhatsApp Ordering System - LIVE v2.1</footer>
<script>
function genQR(){
var t=document.getElementById('tableNo').value;
var url="https://wa.me/919834309809?text=Hi%20Table%20"+t;
document.getElementById('previewQR').src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data="+encodeURIComponent(url);
window.open("/qr/"+t,"_blank");
}
</script>
</body>
</html>
`;
  res.send(html);
});

app.get('/api/rooms', function(req,res){ res.json(roomsData); });

function sendWhatsApp(to, message){
  var url = 'https://graph.facebook.com/v19.0/' + PHONE_ID + '/messages';
  return axios.post(url, {messaging_product:"whatsapp",to:to,type:"text",text:{body:message}}, {headers:{Authorization:'Bearer '+TOKEN}});
}

app.get('/webhook', function(req,res){
  if(req.query['hub.verify_token'] === VERIFY_TOKEN) res.send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

app.post('/webhook', async function(req,res){
  res.sendStatus(200);
  var msg = req.body.entry && req.body.entry[0] && req.body.entry[0].changes && req.body.entry[0].changes[0] && req.body.entry[0].changes[0].value && req.body.entry[0].changes[0].value.messages && req.body.entry[0].changes[0].value.messages[0];
  if(!msg) return;
  var from = msg.from;
  var text = msg.text? msg.text.body : '';
  var location = msg.location;
  if(text.toLowerCase().includes('hi table')){
    var table = text.match(/table\\s*(\\d+)/i);
    var tnum = table? table[1] : '0';
    orders[from] = {table:tnum, status:'WAIT_LOCATION'};
    await sendWhatsApp(from, 'Welcome! Table '+tnum+' 🙏\\nPlease Share Live Location (1 hour)\\n📎 -> Location -> Share Live Location');
    return;
  }
  if(location && orders[from]){
    orders[from].location = location;
    orders[from].status = 'MENU_SENT';
    await sendWhatsApp(from, 'Location saved! ✅ Table '+orders[from].table+'\\n\\nMENU 🍽️\\n1. Biryani - ₹250\\n2. Paneer Tikka - ₹180\\n3. Tea - ₹20\\nType: 2 Biryani, 1 Tea');
    return;
  }
  if(orders[from] && orders[from].status === 'MENU_SENT'){
    orders[from].items = text;
    orders[from].status = 'PENDING_APPROVAL';
    await sendWhatsApp(from, 'Order noted: '+text+' ⏳ Waiting Manager');
    await sendWhatsApp(MANAGER_NUMBER, '🔔 NEW ORDER!\\nTable: '+orders[from].table+'\\nCustomer: '+from+'\\nOrder: '+text+'\\nReply: APPROVE '+from);
    return;
  }
  if(from === MANAGER_NUMBER && text.toUpperCase().startsWith('APPROVE')){
    var custNum = text.split(' ')[1];
    if(orders[custNum]){ orders[custNum].status='COOKING'; await sendWhatsApp(custNum, '✅ Approved! Chef cooking '+orders[custNum].items+' 👨‍🍳'); }
    return;
  }
});

app.get('/manager', function(req,res){ res.send('<h1>Manager '+Object.keys(orders).length+' orders</h1><pre>'+JSON.stringify(orders,null,2)+'</pre><a href="/">Home</a>'); });
app.get('/chef', function(req,res){
  var html='<h1>Chef Panel</h1>';
  for(var num in orders){ if(orders[num].status==='COOKING'){ html+='<div style="border:2px solid;padding:10px;margin:10px"><b>Table '+orders[num].table+': '+orders[num].items+'</b><br><a href="/ready?num='+num+'"><button>READY</button></a></div>'; } }
  html+='<br><a href="/">Home</a>'; res.send(html);
});
app.get('/ready', async function(req,res){
  var num=req.query.num;
  if(orders[num]){ orders[num].status='READY'; await sendWhatsApp(num, '🍛 READY Table '+orders[num].table+': '+orders[num].items+'\\nPayment? CASH or ONLINE'); res.send('Sent Ready! <a href="/chef">Back</a>'); }
  else res.send('Not found');
});
app.get('/qr/:table', async function(req,res){
  var table=req.params.table;
  var link='https://wa.me/'+MANAGER_NUMBER+'?text=Hi%20Table%20'+table;
  var qr=await QRCode.toDataURL(link);
  res.send('<h1>Hotel Chatbot - Table '+table+' QR</h1><img src="'+qr+'" style="width:300px"/><p>'+link+'</p><button onclick="window.print()">Print</button><br><br><a href="/">Home</a>');
});

var PORT = process.env.PORT || 10000;
app.listen(PORT, function(){ console.log('Hotel Chatbot running on '+PORT); });
