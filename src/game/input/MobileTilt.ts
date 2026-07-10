type PermissionAwareOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class MobileTilt {
  value = 0;
  active = false;
  granted = false;
  readonly touchDevice: boolean;
  private readonly orientationType: PermissionAwareOrientationEvent | undefined;
  private readonly tiltButton: HTMLButtonElement;
  private listening = false;

  constructor(forceTouch = false) {
    this.touchDevice =
      forceTouch ||
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;
    this.orientationType = window.DeviceOrientationEvent as PermissionAwareOrientationEvent | undefined;
    const button = document.querySelector<HTMLButtonElement>('#tilt-button');
    if (!button) throw new Error('Missing #tilt-button.');
    this.tiltButton = button;
    this.tiltButton.addEventListener('click', () => void this.request());
    this.refreshButton();
    if (!this.orientationType?.requestPermission) this.listen();
  }

  async request(): Promise<void> {
    try {
      if (this.orientationType?.requestPermission) {
        const result = await this.orientationType.requestPermission();
        if (result !== 'granted') {
          this.granted = false;
          this.refreshButton();
          return;
        }
      }
      this.granted = true;
      this.listen();
      this.refreshButton();
    } catch {
      this.granted = false;
      this.refreshButton();
    }
  }

  private listen(): void {
    if (this.listening || !this.orientationType) return;
    window.addEventListener('deviceorientation', this.onOrientation, { passive: true });
    this.listening = true;
    if (!this.orientationType.requestPermission) this.granted = true;
  }

  private readonly onOrientation = (event: DeviceOrientationEvent): void => {
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    let degrees: number | null;
    if (angle === 90) degrees = event.beta;
    else if (angle === 270 || angle === -90) degrees = event.beta == null ? null : -event.beta;
    else if (angle === 180) degrees = event.gamma == null ? null : -event.gamma;
    else degrees = event.gamma;
    if (degrees == null) return;
    this.active = true;
    const deadZone = 3;
    this.value = Math.abs(degrees) < deadZone
      ? 0
      : PhaserMathClamp((degrees - Math.sign(degrees) * deadZone) / 20, -1, 1);
    this.refreshButton();
  };

  private refreshButton(): void {
    const needsPermission = Boolean(this.orientationType?.requestPermission);
    this.tiltButton.style.display =
      this.touchDevice && needsPermission && !this.granted ? 'block' : 'none';
  }
}

function PhaserMathClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
