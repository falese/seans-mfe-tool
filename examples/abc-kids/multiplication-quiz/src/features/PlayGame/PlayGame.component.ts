/**
 * PlayGame Feature Component (Angular standalone)
 * Play the multiplication quiz game with cat and dog characters
 * Generated from mfe-manifest.yaml capability definition
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface QuizQuestion {
  a: number;
  b: number;
  answer: number;
  askedBy: 'cat' | 'dog';
}

@Component({
  selector: 'playgame-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="quiz-container" *ngIf="!gameOver">
      <div class="score-bar">
        <span class="score">Score: {{ score }} / {{ totalAnswered }}</span>
        <span class="round">Round {{ totalAnswered + 1 }} of {{ totalRounds }}</span>
      </div>

      <div class="character-area">
        <div class="character" [class.active]="currentQuestion.askedBy === 'cat'">
          <div class="avatar cat-avatar">&#128049;</div>
          <div class="name">Whiskers</div>
        </div>
        <div class="speech-bubble">
          <p class="question-text">
            What is {{ currentQuestion.a }} &times; {{ currentQuestion.b }}?
          </p>
        </div>
        <div class="character" [class.active]="currentQuestion.askedBy === 'dog'">
          <div class="avatar dog-avatar">&#128054;</div>
          <div class="name">Barkley</div>
        </div>
      </div>

      <div class="answer-section">
        <div class="feedback" *ngIf="feedback" [class.correct]="lastCorrect" [class.wrong]="!lastCorrect">
          {{ feedback }}
        </div>
        <div class="choices">
          <button
            *ngFor="let choice of choices"
            class="choice-btn"
            [class.disabled]="!!feedback"
            (click)="submitAnswer(choice)"
          >{{ choice }}</button>
        </div>
      </div>
    </div>

    <div class="quiz-container game-over" *ngIf="gameOver">
      <div class="game-over-characters">
        <span class="big-emoji">&#128049;</span>
        <span class="big-emoji">&#127881;</span>
        <span class="big-emoji">&#128054;</span>
      </div>
      <h2>Great Job!</h2>
      <p class="final-score">You got {{ score }} out of {{ totalRounds }} correct!</p>
      <div class="stars">
        <span *ngFor="let s of starsArray" class="star">&#11088;</span>
      </div>
      <button class="play-again-btn" (click)="resetGame()">Play Again</button>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .quiz-container {
      font-family: 'Fredoka One', 'Comic Sans MS', cursive;
      text-align: center;
      padding: 16px;
      color: #fff;
      min-height: 400px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .score-bar {
      display: flex;
      justify-content: space-between;
      padding: 8px 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      font-size: 14px;
    }
    .character-area {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 8px 0;
    }
    .character {
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0.5;
      transition: opacity 0.3s, transform 0.3s;
    }
    .character.active {
      opacity: 1;
      transform: scale(1.15);
    }
    .avatar {
      font-size: 56px;
      line-height: 1;
    }
    .name {
      font-size: 13px;
      margin-top: 4px;
      color: #FFD700;
    }
    .speech-bubble {
      background: rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 16px 24px;
      position: relative;
      max-width: 220px;
    }
    .question-text {
      font-size: 22px;
      margin: 0;
      color: #fff;
    }
    .answer-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .choices {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      max-width: 280px;
      width: 100%;
    }
    .choice-btn {
      font-family: inherit;
      font-size: 20px;
      padding: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 12px;
      background: rgba(255,255,255,0.08);
      color: #fff;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.1s;
    }
    .choice-btn:hover:not(.disabled) {
      background: rgba(255,215,0,0.2);
      border-color: #FFD700;
      transform: scale(1.05);
    }
    .choice-btn.disabled {
      pointer-events: none;
      opacity: 0.6;
    }
    .feedback {
      font-size: 18px;
      padding: 8px 16px;
      border-radius: 8px;
      animation: pop 0.3s ease;
    }
    .feedback.correct { color: #4CAF50; }
    .feedback.wrong { color: #FF6B6B; }
    @keyframes pop {
      0% { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .game-over {
      justify-content: center;
      align-items: center;
    }
    .game-over-characters { font-size: 48px; }
    .game-over h2 { color: #FFD700; font-size: 28px; margin: 8px 0; }
    .final-score { font-size: 18px; color: #aad4ff; }
    .stars { font-size: 32px; margin: 8px 0; }
    .star { margin: 0 2px; }
    .play-again-btn {
      font-family: inherit;
      font-size: 18px;
      padding: 12px 32px;
      border: none;
      border-radius: 24px;
      background: #FFD700;
      color: #1a0050;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;
    }
    .play-again-btn:hover { background: #FFE040; }
    .big-emoji { margin: 0 6px; }
  `],
})
export class PlayGameComponent {
  totalRounds = 10;
  score = 0;
  totalAnswered = 0;
  gameOver = false;
  feedback = '';
  lastCorrect = false;
  choices: number[] = [];
  currentQuestion: QuizQuestion = this.generateQuestion();
  starsArray: number[] = [];

  constructor() {
    this.nextRound();
  }

  private generateQuestion(): QuizQuestion {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return {
      a,
      b,
      answer: a * b,
      askedBy: Math.random() < 0.5 ? 'cat' : 'dog',
    };
  }

  private generateChoices(correct: number): number[] {
    const set = new Set<number>([correct]);
    while (set.size < 4) {
      const offset = Math.floor(Math.random() * 20) - 10;
      const wrong = correct + offset;
      if (wrong > 0 && wrong !== correct) set.add(wrong);
    }
    return Array.from(set).sort(() => Math.random() - 0.5);
  }

  nextRound(): void {
    this.currentQuestion = this.generateQuestion();
    this.choices = this.generateChoices(this.currentQuestion.answer);
    this.feedback = '';
  }

  submitAnswer(choice: number): void {
    if (this.feedback) return;
    const correct = choice === this.currentQuestion.answer;
    this.lastCorrect = correct;
    if (correct) {
      this.score++;
      const who = this.currentQuestion.askedBy === 'cat' ? 'Whiskers' : 'Barkley';
      this.feedback = `Correct! ${who} is impressed!`;
    } else {
      this.feedback = `Oops! The answer was ${this.currentQuestion.answer}.`;
    }
    this.totalAnswered++;
    if (this.totalAnswered >= this.totalRounds) {
      setTimeout(() => {
        this.gameOver = true;
        this.starsArray = Array.from({ length: Math.ceil(this.score / 2) });
      }, 1200);
    } else {
      setTimeout(() => this.nextRound(), 1200);
    }
  }

  resetGame(): void {
    this.score = 0;
    this.totalAnswered = 0;
    this.gameOver = false;
    this.starsArray = [];
    this.nextRound();
  }
}

export default PlayGameComponent;
