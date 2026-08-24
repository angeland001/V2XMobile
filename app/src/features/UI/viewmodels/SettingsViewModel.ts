import { makeAutoObservable } from 'mobx';

export type PreemptionZoneDisplayMode = 'full' | 'icon' | 'off';

export class SettingsViewModel {
  safetyAlerts = true;
  regulatoryAlerts = true;
  informationalAlerts = true;
  carDisplayAlerts = true;
  showVehicles = true;
  showLanes = false;
  preemptionBannerEnabled = true;
  preemptionVoiceAlerts = true;
  preemptionZoneDisplay: PreemptionZoneDisplayMode = 'full';
  sdsmDisplayRadiusM = 250;
  // When true, SDSM vehicles/VRUs render regardless of distance from the
  // user, bypassing sdsmDisplayRadiusM entirely — see
  // VehicleDisplayViewModel.showAllRegardlessOfDistance.
  sdsmShowAllRegardlessOfDistance = false;
  // Defaults to the user's preferred voice (see VoiceGuidanceService's
  // CURATED_VOICE_IDS) rather than the device default. Applies app-wide —
  // see the reaction wiring this into VoiceGuidanceService in
  // MainViewModel's constructor.
  voiceIdentifier: string | null = 'en-us-x-tpc-network';

  constructor() {
    makeAutoObservable(this);
  }
}

export default SettingsViewModel;
