const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');

const app = express();
app.use(express.static(__dirname));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });


let chatbotData;
try {
  chatbotData = JSON.parse(fs.readFileSync('./smartlife-chatbot.json', 'utf8'));
  console.log('✅ JSON loaded! Nodes:', Object.keys(chatbotData.nodes).length);
} catch(e) {
  console.error('❌ smartlife-chatbot.json missing!');
  process.exit(1);
}

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  
  const clientId = Date.now();
  clients.set(clientId, { 
    ws, 
    currentNode: 'L.1', 
    language: 'en',
    history: [],
    formData: {},
    formState: null
  });
  
  sendMessage(clientId);
  
  ws.on('message', (data) => {
    const message = data.toString().trim();
    console.log(`📨 [${clientId}] ${message}`);
    handleMessage(clientId, message);
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log('❌ Client disconnected');
  });
});

function sendMessage(clientId) {
  const client = clients.get(clientId);
  if (!client) return;
  
  const node = chatbotData.nodes[client.currentNode];
  if (!node) {
    client.ws.send(JSON.stringify({ message: "Node not found", options: [] }));
    return;
  }
  
  let response;
  if (node.type === 'form') {
    response = handleFormNode(client, node);
  } else {
    response = {
      message: node.message[client.language] || node.message.en || 'Welcome!',
      options: getNodeOptions(client, node)
    };
  }
  
  client.ws.send(JSON.stringify(response));
  console.log(`📤 [${clientId}] ${client.currentNode}: ${response.message.substring(0, 50)}`);
}

function getNodeOptions(client, node) {
  let options = [];
  

  if (client.currentNode === 'L.1' && node.options) {
    options = node.options.map((opt, index) => ({
      index: index + 1,
      text: opt.text.en 
    }));
    return options;
  }
  

  if (node.options) {
    options = node.options.map((opt, index) => ({
      index: index + 1,
      text: opt.text[client.language] || opt.text.en || Object.values(opt.text)[0]
    }));
  }
  

  if (node.back && client.currentNode !== 'L.1') {
    options.push({
      index: options.length + 1,
      text: getBackText(client.language),
      action: 'back'
    });
  }
  

  if (node.show_global && client.currentNode !== 'L.1' && chatbotData.global_options) {
    chatbotData.global_options.forEach(globalOpt => {
      options.push({
        index: options.length + 1,
        text: globalOpt.text[client.language] || globalOpt.text.en,
        action: globalOpt.action || 'global'
      });
    });
  }
  
  return options;
}

function getBackText(language) {
  return {
    en: "⬅️ Go Back",
    ar: "⬅️ رجوع", 
    hi: "⬅️ वापस"
  }[language] || "⬅️ Go Back";
}

function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;
  
  const node = chatbotData.nodes[client.currentNode];
  

  if (client.formState) {
    handleFormInput(clientId, message);
    return;
  }
  
  const optionIndex = parseInt(message);
  

  if (client.currentNode === 'L.1' && !isNaN(optionIndex) && node.options[optionIndex - 1]) {
    const option = node.options[optionIndex - 1];
    client.language = option.action.split(':')[1]; 
    client.currentNode = option.next; 
    console.log(`🌐 Language: ${client.language} → ${client.currentNode}`);
    sendMessage(clientId);
    return;
  }
  

  if (!isNaN(optionIndex)) {
    let handled = false;
    

    if (node.options && node.options[optionIndex - 1]) {
      const option = node.options[optionIndex - 1];
      handled = true;
      
      if (option.action?.startsWith('set_language:')) {
        client.language = option.action.split(':')[1];
      } else if (option.action === 'back' && node.back) {
        client.currentNode = node.back;
      } else if (option.next) {
        client.currentNode = option.next;
      }
    }
    

    if (!handled && chatbotData.global_options) {
      const globalIndex = optionIndex - (node.options?.length || 0);
      if (chatbotData.global_options[globalIndex]) {
        const globalOpt = chatbotData.global_options[globalIndex];
        handled = true;
        
        if (globalOpt.action === 'end') {
          client.ws.send(JSON.stringify({ message: "Thank you! Goodbye! 🙏", options: [] }));
          return;
        } else if (globalOpt.next) {
          client.currentNode = globalOpt.next;
        }
      }
    }
    
    if (handled) {
      sendMessage(clientId);
    } else {
      sendMessage(clientId);
    }
  } else {
    sendMessage(clientId);
  }
}

function handleFormNode(client, node) {
  if (!client.formState) {
    client.formState = { nodeId: node.id, step: 0, data: {} };
  }
  
  return {
    message: `${node.message[client.language] || node.message.en}\n\n(Simplified form - type anything to continue)`,
    options: node.completion_options?.map((opt, i) => ({
      index: i + 1,
      text: opt.text[client.language] || opt.text.en
    })) || []
  };
}

function handleFormInput(clientId, input) {
  const client = clients.get(clientId);
  client.formState = null;
  client.currentNode = 'W.1';
  sendMessage(clientId);
}

server.listen(3000, () => {
  console.log('SmartLife Chatbot: http://localhost:3000');
});
