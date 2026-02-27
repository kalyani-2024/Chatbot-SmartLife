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
} catch (e) {
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
  } else if (node.type === 'input') {
    // Handle simple input nodes (like newsletter subscription)
    client.inputState = { nodeId: client.currentNode, next: node.next };
    response = {
      message: node.message[client.language] || node.message.en || 'Please enter:',
      options: [],
      expectInput: true
    };
  } else {
    response = {
      message: node.message[client.language] || node.message.en || 'Welcome!',
      options: getNodeOptions(client, node)
    };
  }

  // Include action if node has one (for URL redirections)
  if (node.action) {
    response.action = node.action;
  }

  client.ws.send(JSON.stringify(response));
  console.log(`📤 [${clientId}] ${client.currentNode}: ${response.message.substring(0, 50)}`);
}

function getNodeOptions(client, node) {
  let options = [];

  // Language selection node: always show English labels for language options
  if (client.currentNode === 'L.1' && node.options) {
    options = node.options.map((opt, index) => ({
      index: index + 1,
      text: opt.text.en
    }));
    return options;
  }

  // Build node's own options from the JSON
  if (node.options) {
    options = node.options.map((opt, index) => ({
      index: index + 1,
      text: opt.text[client.language] || opt.text.en || Object.values(opt.text)[0]
    }));
  }

  // Only add auto-generated "Go Back" if node has `back` property
  // AND the node's own options don't already contain a "Back" option
  // to prevent duplicate Back buttons
  if (node.back && client.currentNode !== 'L.1') {
    const hasBackInOptions = node.options && node.options.some(opt => {
      const text = (opt.text[client.language] || opt.text.en || '').toLowerCase().trim();
      return text === 'back' || text === 'go back' || text === '⬅️ go back'
        || text === 'رجوع' || text === 'वापस';
    });

    if (!hasBackInOptions) {
      options.push({
        index: options.length + 1,
        text: getBackText(client.language),
        action: 'back'
      });
    }
  }

  // Add global options (Main Menu, Change Language, End Chat) if node has show_global
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

  // Handle form input first
  if (client.formState) {
    handleFormInput(clientId, message);
    return;
  }

  // Handle simple input nodes (like newsletter name/email)
  if (client.inputState) {
    console.log(`📝 [${clientId}] Input received: ${message}`);
    if (!client.collectedData) client.collectedData = {};
    client.collectedData[client.inputState.nodeId] = message;

    client.currentNode = client.inputState.next;
    client.inputState = null;
    sendMessage(clientId);
    return;
  }

  const optionIndex = parseInt(message);

  // Language selection node: special handling
  if (client.currentNode === 'L.1' && !isNaN(optionIndex) && node.options[optionIndex - 1]) {
    const option = node.options[optionIndex - 1];
    client.language = option.action.split(':')[1];
    client.currentNode = option.next;
    console.log(`🌐 Language: ${client.language} → ${client.currentNode}`);
    sendMessage(clientId);
    return;
  }

  if (!isNaN(optionIndex)) {
    // Build the same flat option list that was displayed to the user
    // so we can correctly map the chosen number to the right action
    const displayedOptions = getDisplayedOptionsMeta(client, node);

    if (optionIndex >= 1 && optionIndex <= displayedOptions.length) {
      const chosen = displayedOptions[optionIndex - 1];

      if (chosen.source === 'node') {
        // This is a regular node option from the JSON
        const option = node.options[chosen.originalIndex];

        if (option.action && option.action.startsWith('set_language:')) {
          client.language = option.action.split(':')[1];
        }

        // Navigate to next node if it has one
        if (option.next) {
          client.currentNode = option.next;
        }
        // If action is call: or link:, send action to client and stay or navigate
        if (option.action && (option.action.startsWith('call:') || option.action.startsWith('link:'))) {
          const actionResponse = {
            message: node.message[client.language] || node.message.en,
            options: getNodeOptions(client, node),
            action: option.action
          };
          client.ws.send(JSON.stringify(actionResponse));
          return;
        }

      } else if (chosen.source === 'back') {
        // Auto-generated "Go Back" button
        client.currentNode = node.back;

      } else if (chosen.source === 'global') {
        // Global option
        const globalOpt = chatbotData.global_options[chosen.originalIndex];

        if (globalOpt.action === 'end') {
          const endMsg = {
            en: "Thank you for using SmartLife! Goodbye! 🙏",
            ar: "شكراً لاستخدامك سمارت لايف! مع السلامة! 🙏",
            hi: "स्मार्टलाइफ उपयोग करने के लिए धन्यवाद! अलविदा! 🙏"
          };
          client.ws.send(JSON.stringify({
            message: endMsg[client.language] || endMsg.en,
            options: []
          }));
          return;
        } else if (globalOpt.action === 'goto_role_menu') {
          // "Main Menu" / "Home" → go to M.1
          client.currentNode = 'M.1';
        } else if (globalOpt.next) {
          client.currentNode = globalOpt.next;
        }
      }

      sendMessage(clientId);
    } else {
      // Invalid option number, re-display current node
      sendMessage(clientId);
    }
  } else {
    // Non-numeric input, re-display current node
    sendMessage(clientId);
  }
}

/**
 * Build metadata list matching exactly what getNodeOptions() displays.
 * Each entry tells us the source (node / back / global) and the original index
 * so handleMessage() can correctly resolve the user's selection.
 */
function getDisplayedOptionsMeta(client, node) {
  const meta = [];

  if (client.currentNode === 'L.1') {
    // Language node — handled separately
    return node.options ? node.options.map((_, i) => ({ source: 'node', originalIndex: i })) : [];
  }

  // 1. Node's own options
  if (node.options) {
    node.options.forEach((opt, i) => {
      meta.push({ source: 'node', originalIndex: i });
    });
  }

  // 2. Auto-generated Back button (only if node has `back` AND options don't already have one)
  if (node.back && client.currentNode !== 'L.1') {
    const hasBackInOptions = node.options && node.options.some(opt => {
      const text = (opt.text[client.language] || opt.text.en || '').toLowerCase().trim();
      return text === 'back' || text === 'go back' || text === '⬅️ go back'
        || text === 'رجوع' || text === 'वापس';
    });

    if (!hasBackInOptions) {
      meta.push({ source: 'back', originalIndex: -1 });
    }
  }

  // 3. Global options
  if (node.show_global && client.currentNode !== 'L.1' && chatbotData.global_options) {
    chatbotData.global_options.forEach((_, i) => {
      meta.push({ source: 'global', originalIndex: i });
    });
  }

  return meta;
}

function handleFormNode(client, node) {
  if (!client.formState) {
    client.formState = {
      nodeId: node.id,
      step: 0,
      data: {},
      completionOptions: node.completion_options || []
    };
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
  const formNode = chatbotData.nodes[client.formState.nodeId];

  // Check if user picked a completion option by number
  const optionIndex = parseInt(input);
  const completionOptions = formNode?.completion_options || client.formState.completionOptions || [];

  if (!isNaN(optionIndex) && optionIndex >= 1 && optionIndex <= completionOptions.length) {
    const chosen = completionOptions[optionIndex - 1];
    client.formState = null;
    if (chosen.next) {
      client.currentNode = chosen.next;
    } else {
      // Fallback: go to role-appropriate menu
      client.currentNode = getRoleMenu(client);
    }
  } else {
    // Not a valid selection, clear form and go to role menu
    client.formState = null;
    client.currentNode = getRoleMenu(client);
  }

  sendMessage(clientId);
}

/**
 * Determine the correct menu node based on the current role context.
 * Falls back to M.1 if role is unknown.
 */
function getRoleMenu(client) {
  const node = chatbotData.nodes[client.currentNode];
  const role = node?.role;
  switch (role) {
    case 'worker': return 'W.1';
    case 'volunteer': return 'V.1';
    case 'company': return 'C.1';
    case 'donor': return 'D.1';
    default: return 'M.1';
  }
}

server.listen(3000, () => {
  console.log('SmartLife Chatbot: http://localhost:3000');
});
