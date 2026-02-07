# SmartLife Chatbot

Welcome to the **SmartLife Chatbot** repository! This project is a WebSocket-based conversational agent designed to empower Dubai's blue-collar workers by connecting them with essential resources such as education (Smart English, Smart Computer), vocational training, health support, and community events.

Additionally, the chatbot serves as a comprehensive portal for **Volunteers**, **Corporate Partners**, and **Donors** to engage with the SmartLife initiative.

## 🚀 Features

- **Multi-Role Support**: Tailored conversation flows for:
  -  **Workers**: Access to education, support, and job opportunities.
  -  **Volunteers**: Opportunities to join community initiatives.
  -  **Companies**: CSR partnerships and event sponsorship.
  -  **Donors**: Contribution channels.
- **Multilingual Support**: Fully localized in **English**, **Arabic**, and **Hindi**.
- **Dynamic Conversation Flows**: All dialogue logic is driven by a flexible JSON configuration (`smartlife-chatbot.json`), allowing for easy updates without code changes.
- **Real-Time Communication**: Built on **WebSockets** for instant, low-latency interaction.
- **Rich Interactions**: Supports menus, informational cards, simplified forms, and external actions (links, emails, calls).

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, `ws` (WebSocket library).
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript.
- **Data Storage**: JSON-based state machine for conversation logic.

## 📋 Prerequisites

Ensure you have **Node.js** installed on your machine. You can download it from [nodejs.org](https://nodejs.org/).

## 📦 Installation

1. **Clone the repository** (or download usage files):
   ```bash
   git clone https://github.com/kalyani-2024/Chatbot-SmartLife.git
   cd Chatbot-SmartLife
   ```

2. **Install dependencies**:
   Open your terminal in the project folder and run:
   ```bash
   npm install
   ```
   *This installs `express`, `ws`, `cors`, and `body-parser`.*

## ▶️ Running the Application

1. **Start the server**:
   ```bash
   node server.js
   ```
   You should see the message: `SmartLife Chatbot: http://localhost:3000`

2. **Access the Chatbot**:
   Open your web browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

## 📂 Project Structure

- **`server.js`**: The main entry point. Sets up the Express server and WebSocket handling. Manages client connections and message routing based on the JSON logic.
- **`index.html`**: The client-side interface for the chatbot. Handles WebSocket connections, displays messages, and captures user input.
- **`smartlife-chatbot.json`**: The heart of the chatbot. Defines all conversation nodes, messages, options, forms, and translations.
- **`package.json`**: Configuration file for project metadata and dependencies.

## ⚙️ Customization

To modify the conversation flow or add new content, edit `smartlife-chatbot.json`.

**Node Structure Example:**
```json
"node_id": {
  "id": "node_id",
  "type": "menu",
  "message": {
    "en": "English Message",
    "ar": "Arabic Message",
    "hi": "Hindi Message"
  },
  "options": [
    {
      "text": { "en": "Option 1" },
      "next": "next_node_id"
    }
  ]
}
```



