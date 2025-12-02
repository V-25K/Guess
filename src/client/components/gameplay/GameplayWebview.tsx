/**
 * Gameplay Webview Component
 * Uses HTML/CSS/JS for native text input support
 */


import type { GameChallenge } from '../../../shared/models/challenge.types.js';

export type GameplayWebviewProps = {
  challenge: GameChallenge;
  score: number;
  message: string;
  isGameOver: boolean;
  revealedCount: number;
};

/**
 * Generate HTML for the gameplay webview
 */
export function generateGameplayHTML(props: GameplayWebviewProps): string {
  const { challenge, score, message, isGameOver } = props;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FFF8F0;
      padding: 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      background: white;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header-left {
      flex: 1;
    }
    
    .creator {
      font-size: 12px;
      color: #878a8c;
      margin-bottom: 4px;
    }
    
    .title {
      font-size: 16px;
      font-weight: bold;
      color: #1c1c1c;
      margin-bottom: 4px;
    }
    
    .tags {
      font-size: 12px;
      color: #FF4500;
    }
    
    .score-box {
      text-align: right;
    }
    
    .score {
      font-size: 24px;
      font-weight: bold;
      color: #FF4500;
    }
    
    .score-label {
      font-size: 12px;
      color: #878a8c;
    }
    
    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .image-box {
      aspect-ratio: 1;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
      background: #E0E0E0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .image-box.revealed {
      background: white;
    }
    
    .image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .image-box .lock {
      font-size: 32px;
    }
    
    .message-box {
      background: ${isGameOver ? '#E8F5E9' : '#FFF4E6'};
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      text-align: center;
    }
    
    .message-text {
      color: ${isGameOver ? '#2E7D32' : '#1c1c1c'};
      font-size: 14px;
    }
    
    .answer-section {
      background: white;
      padding: 16px;
      border-radius: 12px;
      margin-top: auto;
      margin-bottom: 12px;
    }
    
    .answer-label {
      font-size: 16px;
      font-weight: bold;
      color: #1c1c1c;
      margin-bottom: 12px;
    }
    
    .input-wrapper {
      position: relative;
      margin-bottom: 16px;
    }
    
    #answerInput {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      border: 2px solid #E8E0D8;
      border-radius: 8px;
      background: #FFF8F0;
      color: #1c1c1c;
      outline: none;
      transition: border-color 0.2s;
    }
    
    #answerInput:focus {
      border-color: #FF4500;
      background: white;
    }
    
    #answerInput::placeholder {
      color: #878a8c;
    }
    
    .submit-btn {
      width: 100%;
      padding: 16px;
      font-size: 16px;
      font-weight: bold;
      background: #FF4500;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .submit-btn:active {
      background: #E03D00;
    }
    
    .submit-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .game-over-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .btn {
      flex: 1;
      padding: 14px;
      font-size: 16px;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    
    .btn-primary {
      background: #FF4500;
      color: white;
    }
    
    .btn-secondary {
      background: #E0E0E0;
      color: #1c1c1c;
    }
    
    .back-btn {
      width: 100%;
      padding: 12px;
      font-size: 14px;
      background: transparent;
      color: #878a8c;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="creator">by ${challenge.creator_username}</div>
      <div class="title">${challenge.title}</div>
      ${challenge.tags && challenge.tags.length > 0 ? `<div class="tags">${challenge.tags.join(', ')}</div>` : ''}
    </div>
    <div class="score-box">
      <div class="score">${score}</div>
      <div class="score-label">pts</div>
    </div>
  </div>
  
  <div class="images-grid">
    ${challenge.images.map((img, idx) => `
      <div class="image-box ${img.isRevealed ? 'revealed' : ''}" onclick="revealImage(${idx})">
        ${img.isRevealed
      ? `<img src="${img.url}" alt="Hint ${idx + 1}">`
      : '<div class="lock">🔒</div>'
    }
      </div>
    `).join('')}
  </div>
  
  ${message ? `
    <div class="message-box">
      <div class="message-text">${message}</div>
    </div>
  ` : ''}
  
  ${!isGameOver ? `
    <div class="answer-section">
      <div class="answer-label">💭 What's the link?</div>
      <div class="input-wrapper">
        <input 
          type="text" 
          id="answerInput" 
          placeholder="Type your answer here..."
          autocomplete="off"
          autocapitalize="off"
        >
      </div>
      <button class="submit-btn" onclick="submitAnswer()">
        ✅ Submit Answer
      </button>
    </div>
  ` : `
    <div class="game-over-actions">
      <button class="btn btn-primary" onclick="nextChallenge()">
        Next Challenge →
      </button>
      <button class="btn btn-secondary" onclick="backToMenu()">
        Menu
      </button>
    </div>
  `}
  
  <button class="back-btn" onclick="backToMenu()">
    ← Back to Menu
  </button>
  
  <script>
    function revealImage(index) {
      if (${isGameOver}) return;
      window.parent.postMessage({
        type: 'revealImage',
        data: { index }
      }, '*');
    }
    
    function submitAnswer() {
      const input = document.getElementById('answerInput');
      const guess = input.value.trim();
      
      if (!guess) {
        alert('Please enter an answer');
        return;
      }
      
      window.parent.postMessage({
        type: 'submitGuess',
        data: { guess }
      }, '*');
      
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '⏳ Checking...';
      
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '✅ Submit Answer';
      }, 3000);
    }
    
    function nextChallenge() {
      window.parent.postMessage({
        type: 'nextChallenge',
        data: {}
      }, '*');
    }
    
    function backToMenu() {
      window.parent.postMessage({
        type: 'backToMenu',
        data: {}
      }, '*');
    }
    
    window.addEventListener('load', () => {
      const input = document.getElementById('answerInput');
      if (input) {
        setTimeout(() => input.focus(), 300);
      }
    });
  </script>
</body>
</html>
  `;
}

