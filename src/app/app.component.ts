import { Component, OnDestroy, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { VisorComponent } from './shared/visor/visor.component';
import { activarArrastreDeHojas } from './shared/arrastrar-hojas';

@Component({
  selector: 'app-root',
  template: `<ion-app><ion-router-outlet></ion-router-outlet><app-visor></app-visor></ion-app>`,
  imports: [IonApp, IonRouterOutlet, VisorComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private quitarArrastre?: () => void;

  // iPhone: al cerrar el teclado Safari a veces deja la página corrida hacia
  // arriba (con el body fijo de Ionic) y los toques caen en el lugar
  // equivocado, como si la app se trabara. Al salir de un campo se devuelve.
  private alSalirDeCampo = (): void => {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const activo = document.activeElement;
      const enCampo = activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement || activo instanceof HTMLSelectElement;
      if (!enCampo && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0);
    }, 120);
  };

  ngOnInit(): void {
    document.addEventListener('focusout', this.alSalirDeCampo);
    this.quitarArrastre = activarArrastreDeHojas();
  }

  ngOnDestroy(): void {
    document.removeEventListener('focusout', this.alSalirDeCampo);
    this.quitarArrastre?.();
  }
}
