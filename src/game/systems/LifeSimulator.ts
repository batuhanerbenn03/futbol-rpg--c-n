export interface LifeProfile
{
    /** Player's preferred peak-performance time, in local hours from 0 to 24. */
    circadianPeakHour: number;
    /** Recent sleep quality from 0 (poor) to 1 (excellent). */
    sleepQuality: number;
    /** Current media pressure from 0 (none) to 1 (extreme). */
    mediaPressure: number;
    /** Recent nightlife activity from 0 (none) to 1 (frequent). */
    nightlife: number;
    /** Recent casino activity from 0 (none) to 1 (frequent). */
    casino: number;
}

export interface MatchConditions
{
    /** Local match start time, in hours from 0 to 24. */
    matchHour: number;
    /** Optional match-day overrides, each from 0 to 1. */
    sleepQuality?: number;
    mediaPressure?: number;
    nightlife?: number;
    casino?: number;
}

export interface MatchEffects
{
    /** Estimated time to react to a pass, in milliseconds. */
    passReactionLatencyMs: number;
    /** Estimated time to react to a shot, in milliseconds. */
    shotReactionLatencyMs: number;
    /** Match composure on a 0 to 100 scale. */
    composure: number;
    /** Normalized contributing factors, each from 0 to 1. */
    factors: {
        circadianMismatch: number;
        sleepDeprivation: number;
        mediaPressure: number;
        nightlife: number;
        casino: number;
        fatigue: number;
        mentalStress: number;
    };
}

const DEFAULT_PROFILE: LifeProfile = {
    circadianPeakHour: 15,
    sleepQuality: 0.8,
    mediaPressure: 0,
    nightlife: 0,
    casino: 0
};

function assertUnitInterval(name: string, value: number): void
{
    if (!Number.isFinite(value) || value < 0 || value > 1)
    {
        throw new RangeError(`${name} must be a finite number between 0 and 1.`);
    }
}

function assertHour(name: string, value: number): void
{
    if (!Number.isFinite(value) || value < 0 || value >= 24)
    {
        throw new RangeError(`${name} must be a finite hour from 0 (inclusive) to 24 (exclusive).`);
    }
}

function clamp(value: number, min: number, max: number): number
{
    return Math.max(min, Math.min(max, value));
}

export class LifeSimulator
{
    private readonly profile: LifeProfile;

    constructor(profile: Partial<LifeProfile> = {})
    {
        this.profile = { ...DEFAULT_PROFILE, ...profile };
        assertHour('circadianPeakHour', this.profile.circadianPeakHour);
        assertUnitInterval('sleepQuality', this.profile.sleepQuality);
        assertUnitInterval('mediaPressure', this.profile.mediaPressure);
        assertUnitInterval('nightlife', this.profile.nightlife);
        assertUnitInterval('casino', this.profile.casino);
    }

    /**
     * Estimates the player's in-match reactions and composure from their
     * circadian timing, recent habits, sleep, and media pressure.
     */
    simulateMatch(conditions: MatchConditions): MatchEffects
    {
        assertHour('matchHour', conditions.matchHour);

        const sleepQuality = conditions.sleepQuality ?? this.profile.sleepQuality;
        const mediaPressure = conditions.mediaPressure ?? this.profile.mediaPressure;
        const nightlife = conditions.nightlife ?? this.profile.nightlife;
        const casino = conditions.casino ?? this.profile.casino;

        assertUnitInterval('sleepQuality', sleepQuality);
        assertUnitInterval('mediaPressure', mediaPressure);
        assertUnitInterval('nightlife', nightlife);
        assertUnitInterval('casino', casino);

        const hourDifference = Math.abs(this.profile.circadianPeakHour - conditions.matchHour);
        const circadianMismatch = Math.min(hourDifference, 24 - hourDifference) / 12;
        const sleepDeprivation = 1 - sleepQuality;
        const fatigue = clamp(
            circadianMismatch * 0.35 +
                sleepDeprivation * 0.4 +
                nightlife * 0.15 +
                casino * 0.1,
            0,
            1
        );
        const mentalStress = clamp(mediaPressure * 0.75 + casino * 0.25, 0, 1);

        return {
            passReactionLatencyMs: 220 + fatigue * 260 + mentalStress * 140,
            shotReactionLatencyMs: 270 + fatigue * 320 + mentalStress * 190,
            composure: clamp(82 - fatigue * 20 - mentalStress * 30, 0, 100),
            factors: {
                circadianMismatch,
                sleepDeprivation,
                mediaPressure,
                nightlife,
                casino,
                fatigue,
                mentalStress
            }
        };
    }
}
