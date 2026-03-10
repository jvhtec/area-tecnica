/**
 * Stream Deck WebSocket Server
 *
 * This server allows the Stream Deck plugin to communicate with the web app.
 * Keep this running while using Stream Deck integration.
 */

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

console.log('🎮 Stream Deck WebSocket Server');
console.log('================================');
console.log('✅ Running on ws://localhost:3001');
console.log('');
console.log('Keep this terminal open while using Stream Deck.');
console.log('Press Ctrl+C to stop.');
console.log('');

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  ws.on('message', (message) => {
    try {
      // Ensure message is a string (ws v8 sends Buffers by default)
      const messageString = message.toString();
      const data = JSON.parse(messageString);
      console.log('📨 Received:', data);

      // Handle ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        console.log('📤 Sent: pong');
        return;
      }

      // Broadcast to all other clients as string
      let broadcastCount = 0;
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(messageString);
          broadcastCount++;
        }
      });
      console.log(`📤 Broadcast to ${broadcastCount} other clients`);
    } catch (e) {
      console.error('❌ Error processing message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down Stream Deck server...');
  wss.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
