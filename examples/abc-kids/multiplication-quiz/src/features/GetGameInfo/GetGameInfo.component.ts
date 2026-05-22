/**
 * GetGameInfo Feature Component (Angular standalone)
 * Return game metadata including title, age range, and description
 * Generated from mfe-manifest.yaml capability definition
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'getgameinfo-component',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-card">
      <h3>Multiplication Quiz</h3>
      <ul>
        <li><strong>Ages:</strong> 5 &ndash; 10</li>
        <li><strong>Category:</strong> Math</li>
        <li><strong>Rounds:</strong> 10</li>
        <li><strong>Characters:</strong> Whiskers (cat) &amp; Barkley (dog)</li>
      </ul>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .info-card {
      font-family: 'Fredoka One', 'Comic Sans MS', cursive;
      color: #fff;
      padding: 16px;
    }
    h3 { color: #FFD700; margin: 0 0 8px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { margin: 4px 0; font-size: 14px; color: #aad4ff; }
    strong { color: #fff; }
  `],
})
export class GetGameInfoComponent {}

export default GetGameInfoComponent;
