import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { Player } from '@/entity/player';
import { UI_TEXTURES, uiTexture } from './ui-assets';

export interface PlayerViewInput {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly grounded: boolean;
  readonly walkPhase: number;
  readonly aimX: number;
  readonly aimY: number;
}

interface BodyPart {
  readonly joint: Container;
  readonly sprite: Sprite;
}

export class PlayerView {
  readonly container = new Container();
  private readonly root = new Container();
  private readonly head: BodyPart;
  private readonly torso: BodyPart;
  private readonly leftArm: BodyPart;
  private readonly rightArm: BodyPart;
  private readonly leftLeg: BodyPart;
  private readonly rightLeg: BodyPart;
  private facing = 1;

  constructor() {
    const skin = uiTexture(UI_TEXTURES.playerSkin);
    this.container.label = 'player';
    this.container.addChild(this.root);

    this.rightArm = this.part(texturePart(skin, 44, 20, 4, 12), 0.22, 0.78, 0.39, -1.22);
    this.rightLeg = this.part(texturePart(skin, 4, 20, 4, 12), 0.24, 0.78, 0.13, -0.64);
    this.torso = this.part(texturePart(skin, 20, 20, 8, 12), 0.58, 0.74, 0, -1.3);
    this.leftLeg = this.part(texturePart(skin, 20, 52, 4, 12), 0.24, 0.78, -0.13, -0.64);
    this.leftArm = this.part(texturePart(skin, 36, 52, 4, 12), 0.22, 0.78, -0.39, -1.22);
    this.head = this.part(texturePart(skin, 8, 8, 8, 8), 0.58, 0.58, 0, -1.33, 0.5, 0.86);
  }

  update(input: PlayerViewInput): void {
    this.container.position.set(input.x, input.y);

    if (Math.abs(input.aimX - input.x) > 0.05) {
      this.facing = input.aimX < input.x ? -1 : 1;
    } else if (Math.abs(input.vx) > 0.05) {
      this.facing = input.vx < 0 ? -1 : 1;
    }
    this.root.scale.x = this.facing;

    const moving = input.grounded && Math.abs(input.vx) > 0.05;
    const swing = moving ? Math.sin(input.walkPhase) * 0.55 : 0;
    const airborne = input.grounded ? 0 : clamp(input.vy / 24, -0.35, 0.35);

    this.leftArm.joint.rotation = swing;
    this.rightArm.joint.rotation = -swing;
    this.leftLeg.joint.rotation = -swing * 0.75 + airborne;
    this.rightLeg.joint.rotation = swing * 0.75 - airborne;
    this.torso.joint.rotation = moving ? Math.sin(input.walkPhase * 0.5) * 0.035 : 0;

    const headWorldY = input.y - Player.HEIGHT + 0.28;
    const worldAim = Math.atan2(input.aimY - headWorldY, input.aimX - input.x);
    const localAim = this.facing === 1 ? worldAim : Math.PI - worldAim;
    this.head.joint.rotation = clamp(normalizeAngle(localAim), -0.5, 0.5);
  }

  private part(
    texture: Texture,
    width: number,
    height: number,
    x: number,
    y: number,
    anchorX: number = 0.5,
    anchorY: number = 0,
  ): BodyPart {
    const joint = new Container();
    joint.position.set(x, y);

    const sprite = new Sprite(texture);
    sprite.anchor.set(anchorX, anchorY);
    sprite.setSize(width, height);
    joint.addChild(sprite);
    this.root.addChild(joint);
    return { joint, sprite };
  }
}

function texturePart(base: Texture, x: number, y: number, width: number, height: number): Texture {
  return new Texture({
    source: base.source,
    frame: new Rectangle(x, y, width, height),
  });
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
