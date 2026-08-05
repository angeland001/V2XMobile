import { makeAutoObservable } from 'mobx';

export class SettingsViewModel {
  safetyAlerts = true;
  regulatoryAlerts = true;
  informationalAlerts = true;
  showVehicles = true;
  showLanes = false;
  trafficLightPanelEnabled = true;

  constructor() {
    makeAutoObservable(this);
  }
}

export default SettingsViewModel;
