class ChatbotEngine {
  constructor(chatbotJSON) {
    this.nodes = chatbotJSON.nodes;
    this.globalOptions = chatbotJSON.global_options || [];
  }

//Getting the nodes from ID
  getNode(nodeId) {
    return this.nodes[nodeId];
  }

//selects on the basis of language
  getText(textObject, language) {
    return textObject[language] || textObject['en'];
  }

//response for current node
  getNodeResponse(nodeId, language) {
    const node = this.getNode(nodeId);
    
    if (!node) {
      return {
        error: true,
        message: "Node not found"
      };
    }

    const response = {
      nodeId: node.id,
      type: node.type,
      message: this.getText(node.message, language),
      options: []
    };

//
    if (node.options) {
      response.options = node.options.map((opt, index) => ({
        index: index,
        text: this.getText(opt.text, language),
        next: opt.next,
        action: opt.action,
        role: opt.role
      }));
    }

//
    if (node.show_global) {
      response.globalOptions = this.globalOptions.map((opt, index) => ({
        text: this.getText(opt.text, language),
        action: opt.action,
        next: opt.next
      }));
    }

//back
    if (node.back) {
      response.back = node.back;
    }
//
    if (node.type === 'form') {
      response.fields = node.fields.map(field => ({
        name: field.name,
        type: field.type,
        question: this.getText(field.question, language),
        required: field.required,
        choices: field.choices ? field.choices.map(c => ({
          value: c.value,
          text: this.getText(c.text, language)
        })) : null
      }));
      response.webhook = node.webhook;
    }

    return response;
  }


  selectOption(currentNodeId, optionIndex, language) {
    const node = this.getNode(currentNodeId);
    const selectedOption = node.options[optionIndex];

    if (!selectedOption) {
      return { error: true, message: "Invalid option" };
    }


    if (selectedOption.action) {
      return this.handleAction(selectedOption.action, language);
    }

    if (selectedOption.next) {
      return {
        nextNode: selectedOption.next,
        role: selectedOption.role || null,
        response: this.getNodeResponse(selectedOption.next, language)
      };
    }
  }

  handleAction(action, language) {
    if (action === 'goto_role_menu') {
      return {
        nextNode: 'M.1',
        response: this.getNodeResponse('M.1', language)
      };
    }

    if (action === 'end') {
      return {
        type: 'end',
        message: this.getText({
          en: "Thank you for using SmartLife! 🙏",
          ar: "شكراً لاستخدامك سمارت لايف! 🙏",
          hi: "स्मार्टलाइफ उपयोग करने के लिए धन्यवाद! 🙏"
        }, language)
      };
    }

    if (action.startsWith('set_language:')) {
      const newLanguage = action.split(':')[1];
      return {
        action: 'language_changed',
        language: newLanguage
      };
    }

    if (action.startsWith('call:')) {
      return {
        type: 'call',
        phoneNumber: action.split(':')[1]
      };
    }

    return { error: true, message: "Unknown action" };
  }


  submitForm(nodeId, formData, language) {
    const node = this.getNode(nodeId);
    
    if (node.type !== 'form') {
      return { error: true, message: "Not a form node" };
    }

  
    let confirmation = this.getText(node.confirmation, language);
    Object.keys(formData).forEach(key => {
      confirmation = confirmation.replace(`{${key}}`, formData[key]);
    });

    return {
      success: true,
      confirmation: confirmation,
      webhook: node.webhook,
      completionOptions: node.completion_options?.map(opt => ({
        text: this.getText(opt.text, language),
        next: opt.next
      }))
    };
  }
}

module.exports = ChatbotEngine;
