import * as Matter from 'matter-js';
import { Scene } from 'phaser';

export interface HitPoint
{
    x: number;
    y: number;
}

export interface BallPhysicsOptions
{
    /** Air-resistance rate per second. */
    airResistance?: number;
    /** Fraction of velocity removed per 60 Hz frame while on grass. */
    grassFriction?: number;
    /** Fraction of angular velocity removed per second while on grass. */
    grassSpinFriction?: number;
    /** Strength of the spin-induced Magnus force. */
    magnusCoefficient?: number;
    /** Restitution used by bounce(). */
    restitution?: number;
    /** Return true when the ball is in contact with the grass. */
    isOnGrass?: () => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<BallPhysicsOptions, 'isOnGrass'>> = {
    airResistance: 0.08,
    grassFriction: 0.02,
    grassSpinFriction: 0.8,
    magnusCoefficient: 0.0005,
    restitution: 0.65
};

export class BallPhysics
{
    private readonly options: Required<Omit<BallPhysicsOptions, 'isOnGrass'>> & Pick<BallPhysicsOptions, 'isOnGrass'>;
    private destroyed = false;

    constructor(
        private readonly scene: Scene,
        private readonly body: Matter.Body,
        options: BallPhysicsOptions = {}
    )
    {
        this.options = { ...DEFAULT_OPTIONS, ...options };

        if (!Number.isFinite(this.options.airResistance) ||
            !Number.isFinite(this.options.grassFriction) ||
            !Number.isFinite(this.options.grassSpinFriction) ||
            !Number.isFinite(this.options.magnusCoefficient) ||
            !Number.isFinite(this.options.restitution) ||
            this.options.airResistance < 0 ||
            this.options.grassFriction < 0 ||
            this.options.grassFriction >= 1 ||
            this.options.grassSpinFriction < 0 ||
            this.options.restitution < 0 ||
            this.options.restitution > 1)
        {
            throw new RangeError('Ball physics options are outside their valid ranges.');
        }

        this.scene.events.on('update', this.update, this);
    }

    /**
     * Applies a kick force at a world-space point. An off-center hit also
     * applies the corresponding spin through Matter's force-at-point torque.
     */
    applyKick(force: Phaser.Math.Vector2, hitPoint: HitPoint = this.body.position): void
    {
        Matter.Body.applyForce(this.body, hitPoint, { x: force.x, y: force.y });
    }

    /**
     * Reflects the ball's velocity around a surface normal and returns its
     * resulting direction in radians.
     */
    bounce(surfaceNormal: Phaser.Math.Vector2, restitution = this.options.restitution): number
    {
        const normalLength = Math.hypot(surfaceNormal.x, surfaceNormal.y);

        if (normalLength === 0)
        {
            throw new RangeError('The bounce surface normal must not be zero.');
        }

        const normalX = surfaceNormal.x / normalLength;
        const normalY = surfaceNormal.y / normalLength;
        const velocity = this.body.velocity;
        const normalVelocity = velocity.x * normalX + velocity.y * normalY;

        if (normalVelocity < 0)
        {
            Matter.Body.setVelocity(this.body, {
                x: velocity.x - (1 + restitution) * normalVelocity * normalX,
                y: velocity.y - (1 + restitution) * normalVelocity * normalY
            });
        }

        return Math.atan2(this.body.velocity.y, this.body.velocity.x);
    }

    /**
     * Phaser UPDATE callback. Call destroy() when this helper is no longer used.
     */
    update(_time: number, delta: number): void
    {
        if (this.destroyed || delta <= 0)
        {
            return;
        }

        const timeScale = delta / 1000;
        const velocity = this.body.velocity;
        const airDamping = Math.exp(-this.options.airResistance * timeScale);

        Matter.Body.setVelocity(this.body, {
            x: velocity.x * airDamping,
            y: velocity.y * airDamping
        });

        if (this.options.isOnGrass?.())
        {
            const grassDamping = Math.pow(1 - this.options.grassFriction, delta / (1000 / 60));
            const grassSpinDamping = Math.exp(-this.options.grassSpinFriction * timeScale);
            const currentVelocity = this.body.velocity;

            Matter.Body.setVelocity(this.body, {
                x: currentVelocity.x * grassDamping,
                y: currentVelocity.y * grassDamping
            });
            Matter.Body.setAngularVelocity(this.body, this.body.angularVelocity * grassSpinDamping);
        }

        const currentVelocity = this.body.velocity;
        const magnusForce = this.options.magnusCoefficient * this.body.angularVelocity;

        Matter.Body.applyForce(this.body, this.body.position, {
            x: -currentVelocity.y * magnusForce,
            y: currentVelocity.x * magnusForce
        });
    }

    destroy(): void
    {
        if (this.destroyed)
        {
            return;
        }

        this.scene.events.off('update', this.update, this);
        this.destroyed = true;
    }
}
