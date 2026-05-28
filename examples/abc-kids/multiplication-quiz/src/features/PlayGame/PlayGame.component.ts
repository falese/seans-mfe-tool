/**
 * PlayGame Feature Component (Angular standalone)
 * Multiplication quiz — cat and dog take turns asking questions
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Question {
  a: number;
  b: number;
  choices: number[];
  correct: number;
}

@Component({
  selector: 'playgame-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; font-family: 'Segoe UI', sans-serif; }

    .quiz-wrap {
      background: linear-gradient(135deg, #1a0050 0%, #2d0080 100%);
      color: #fff;
      padding: 24px;
      border-radius: 12px;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .scoreboard {
      display: flex;
      gap: 32px;
      font-size: 14px;
      color: #ccc;
    }
    .scoreboard span { color: #FFD700; font-weight: bold; font-size: 18px; }

    .character {
      font-size: 56px;
      line-height: 1;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
      transition: transform 0.2s;
    }
    .character.bounce { animation: bounce 0.4s ease; }
    @keyframes bounce {
      0%,100% { transform: translateY(0); }
      40%      { transform: translateY(-16px); }
    }

    .speech-bubble {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 16px;
      padding: 16px 28px;
      font-size: 26px;
      font-weight: bold;
      letter-spacing: 1px;
      text-align: center;
    }

    .choices {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      max-width: 380px;
    }

    .choice-btn {
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      color: #fff;
      font-size: 22px;
      font-weight: bold;
      padding: 14px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s, border-color 0.15s;
    }
    .choice-btn:hover { background: rgba(255,255,255,0.22); transform: scale(1.04); }
    .choice-btn.correct  { background: #1a7a1a; border-color: #4cff4c; }
    .choice-btn.wrong    { background: #7a1a1a; border-color: #ff4c4c; }
    .choice-btn:disabled { cursor: default; transform: none; }

    .feedback {
      font-size: 20px;
      font-weight: bold;
      min-height: 28px;
      text-align: center;
    }
    .feedback.correct { color: #4cff4c; }
    .feedback.wrong   { color: #ff7070; }

    .next-btn {
      background: #FFD700;
      color: #1a0050;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      padding: 10px 28px;
      cursor: pointer;
      transition: transform 0.1s, background 0.1s;
    }
    .next-btn:hover { background: #ffe94d; transform: scale(1.04); }

    .game-over {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .game-over h2 { font-size: 28px; color: #FFD700; }
    .game-over p  { font-size: 18px; color: #ccc; }
    .restart-btn {
      background: #FFD700;
      color: #1a0050;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      padding: 12px 32px;
      cursor: pointer;
    }
  `],
  template: `
    <div class="quiz-wrap">
      <div class="scoreboard">
        <div>Score: <span>{{ score }}</span></div>
        <div>Q {{ questionIndex + 1 }} / {{ total }}</div>
        <div>Streak: <span>{{ streak }}</span> 🔥</div>
      </div>

      <ng-container *ngIf="!gameOver; else gameOverBlock">
        <div class="character" [class.bounce]="bouncing">{{ asker }}</div>

        <div class="speech-bubble">
          {{ q.a }} &times; {{ q.b }} = ?
        </div>

        <div class="choices">
          <button
            *ngFor="let c of q.choices"
            class="choice-btn"
            [class.correct]="answered && c === q.correct"
            [class.wrong]="answered && c === chosen && c !== q.correct"
            [disabled]="answered"
            (click)="pick(c)">
            {{ c }}
          </button>
        </div>

        <div class="feedback" [class.correct]="feedbackClass === 'correct'" [class.wrong]="feedbackClass === 'wrong'">
          {{ feedback }}
        </div>

        <button *ngIf="answered" class="next-btn" (click)="next()">
          {{ questionIndex + 1 < total ? 'Next →' : 'See results' }}
        </button>
      </ng-container>

      <ng-template #gameOverBlock>
        <div class="game-over">
          <div style="font-size:72px">{{ score === total ? '🏆' : score >= total * 0.7 ? '🌟' : '🐾' }}</div>
          <h2>{{ score === total ? 'Perfect score!' : score >= total * 0.7 ? 'Great work!' : 'Keep practising!' }}</h2>
          <p>You got <strong style="color:#FFD700">{{ score }} / {{ total }}</strong> correct!</p>
          <button class="restart-btn" (click)="restart()">Play again 🔄</button>
        </div>
      </ng-template>
    </div>
  `,
})
export class PlayGameComponent implements OnInit {
  readonly total = 8;
  questions: Question[] = [];
  questionIndex = 0;
  score = 0;
  streak = 0;
  answered = false;
  chosen: number | null = null;
  feedback = '';
  feedbackClass = '';
  gameOver = false;
  bouncing = false;

  readonly characters = ['🐱', '🐶'];

  get q(): Question { return this.questions[this.questionIndex]; }
  get asker(): string { return this.characters[this.questionIndex % 2]; }

  ngOnInit(): void { this.restart(); }

  restart(): void {
    this.questions = this.generateQuestions(this.total);
    this.questionIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.answered = false;
    this.chosen = null;
    this.feedback = '';
    this.feedbackClass = '';
    this.gameOver = false;
    this.triggerBounce();
  }

  pick(choice: number): void {
    if (this.answered) return;
    this.answered = true;
    this.chosen = choice;
    if (choice === this.q.correct) {
      this.score++;
      this.streak++;
      this.feedback = this.streak >= 3 ? `🔥 ${this.streak} in a row!` : '✓ Correct!';
      this.feedbackClass = 'correct';
    } else {
      this.streak = 0;
      this.feedback = `✗ The answer was ${this.q.correct}`;
      this.feedbackClass = 'wrong';
    }
  }

  next(): void {
    if (this.questionIndex + 1 >= this.total) {
      this.gameOver = true;
      return;
    }
    this.questionIndex++;
    this.answered = false;
    this.chosen = null;
    this.feedback = '';
    this.feedbackClass = '';
    this.triggerBounce();
  }

  private triggerBounce(): void {
    this.bouncing = false;
    setTimeout(() => { this.bouncing = true; }, 10);
    setTimeout(() => { this.bouncing = false; }, 450);
  }

  private generateQuestions(n: number): Question[] {
    const qs: Question[] = [];
    const used = new Set<string>();
    while (qs.length < n) {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = Math.floor(Math.random() * 12) + 1;
      const key = `${Math.min(a,b)}-${Math.max(a,b)}`;
      if (used.has(key)) continue;
      used.add(key);
      const correct = a * b;
      qs.push({ a, b, correct, choices: this.makeChoices(correct) });
    }
    return qs;
  }

  private makeChoices(correct: number): number[] {
    const set = new Set<number>([correct]);
    while (set.size < 4) {
      const delta = (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? 1 : -1);
      const c = correct + delta;
      if (c > 0) set.add(c);
    }
    return [...set].sort(() => Math.random() - 0.5);
  }
}

export default PlayGameComponent;
