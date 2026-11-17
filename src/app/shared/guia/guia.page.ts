import { Component } from '@angular/core';
import { GuiaComponent } from './guia.component';

/** Página "Guía de la app" (desde el menú): la misma guía del primer ingreso */
@Component({
  selector: 'app-guia-pagina',
  standalone: true,
  imports: [GuiaComponent],
  styles: [`.page { max-width: 520px; }`],
  template: `<div class="page"><div class="head"><div><h1>Guía de la app</h1></div></div><app-guia modo="pagina"></app-guia></div>`,
  styleUrls: ['../ui.scss'],
})
export class GuiaPage {}
