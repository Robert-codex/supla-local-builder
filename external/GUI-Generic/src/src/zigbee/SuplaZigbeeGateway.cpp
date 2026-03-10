#include "SuplaZigbeeGateway.h"

#if defined(SUPLA_ZIGBEE_GATEWAY) && defined(CONFIG_IDF_TARGET_ESP32C6)

#include <ZigbeeGateway.h>
#include <esp_coexist.h>

#include <SuplaDevice.h>
#include <Z2S_Devices_Table.h>
#include <Z2S_devices_database.h>

namespace {

constexpr uint8_t kGatewayEndpointNumber = 1;
constexpr uint8_t kGatewayButtonPin = 9;
constexpr uint32_t kOpenNetworkSeconds = 180;
constexpr uint32_t kFactoryResetHoldMs = 5000;

ZigbeeGateway zbGateway(kGatewayEndpointNumber);
bool zigbeeInitPending = true;
uint32_t buttonPressStartedAt = 0;

bool matchAndBindJoinedDevice(zb_device_params_t *joinedDevice) {
  if (joinedDevice == nullptr) {
    return false;
  }

  zbGateway.zbQueryDeviceBasicCluster(joinedDevice);

  auto *query = zbGateway.getQueryBasicClusterData();
  const uint16_t devicesListSize = sizeof(Z2S_DEVICES_LIST) / sizeof(Z2S_DEVICES_LIST[0]);
  const uint16_t devicesDescSize = sizeof(Z2S_DEVICES_DESC) / sizeof(Z2S_DEVICES_DESC[0]);

  for (uint16_t i = 0; i < devicesListSize; i++) {
    const auto &deviceEntity = Z2S_DEVICES_LIST[i];
    if (strcmp(query->zcl_model_name, deviceEntity.model_name) != 0 ||
        strcmp(query->zcl_manufacturer_name, deviceEntity.manufacturer_name) != 0) {
      continue;
    }

    for (uint8_t endpointIndex = 0; endpointIndex < deviceEntity.z2s_device_endpoints_count; endpointIndex++) {
      const uint8_t endpointId =
          deviceEntity.z2s_device_endpoints_count == 1 ? 1 : deviceEntity.z2s_device_endpoints[endpointIndex].endpoint_id;
      const uint32_t descId = deviceEntity.z2s_device_endpoints_count == 1
                                  ? deviceEntity.z2s_device_desc_id
                                  : deviceEntity.z2s_device_endpoints[endpointIndex].z2s_device_desc_id;

      for (uint16_t descIndex = 0; descIndex < devicesDescSize; descIndex++) {
        const auto &deviceDesc = Z2S_DEVICES_DESC[descIndex];
        if (deviceDesc.z2s_device_desc_id != descId) {
          continue;
        }

        joinedDevice->endpoint = endpointId;
        joinedDevice->model_id = deviceDesc.z2s_device_desc_id;

        if (joinedDevice->model_id == Z2S_DEVICE_DESC_SWITCH_4X3) {
          Z2S_addZ2SDevice(joinedDevice, 0);
          Z2S_addZ2SDevice(joinedDevice, 1);
          Z2S_addZ2SDevice(joinedDevice, 2);
        } else {
          Z2S_addZ2SDevice(joinedDevice, -1);
        }

        for (uint8_t clusterIndex = 0; clusterIndex < deviceDesc.z2s_device_clusters_count; clusterIndex++) {
          zbGateway.bindDeviceCluster(joinedDevice, deviceDesc.z2s_device_clusters[clusterIndex]);
        }

        return true;
      }
    }
  }

  return false;
}

void processJoinedDevices() {
  if (!zbGateway.isNewDeviceJoined()) {
    return;
  }

  zbGateway.clearNewDeviceJoined();
  while (!zbGateway.getJoinedDevices().empty()) {
    auto *joinedDevice = zbGateway.getLastJoinedDevice();
    if (matchAndBindJoinedDevice(joinedDevice)) {
      SuplaDevice.scheduleSoftRestart(5000);
    }
  }
}

void handleGatewayButton() {
  if (digitalRead(kGatewayButtonPin) == LOW) {
    if (buttonPressStartedAt == 0) {
      buttonPressStartedAt = millis();
    }

    if (millis() - buttonPressStartedAt >= kFactoryResetHoldMs) {
      Serial.println("Resetting Zigbee to factory settings");
      Zigbee.factoryReset();
      buttonPressStartedAt = 0;
    }
    return;
  }

  if (buttonPressStartedAt != 0) {
    Zigbee.openNetwork(kOpenNetworkSeconds);
    buttonPressStartedAt = 0;
  }
}

}  // namespace

namespace Supla {
namespace GUI {
namespace ZigbeeGatewayMode {

void setup() {
  pinMode(kGatewayButtonPin, INPUT);

  Z2S_loadDevicesTable();
  Z2S_initSuplaChannels();

  zbGateway.onTemperatureReceive(Z2S_onTemperatureReceive);
  zbGateway.onHumidityReceive(Z2S_onHumidityReceive);
  zbGateway.onOnOffReceive(Z2S_onOnOffReceive);
  zbGateway.onRMSVoltageReceive(Z2S_onRMSVoltageReceive);
  zbGateway.onRMSCurrentReceive(Z2S_onRMSCurrentReceive);
  zbGateway.onRMSActivePowerReceive(Z2S_onRMSActivePowerReceive);
  zbGateway.onBatteryPercentageReceive(Z2S_onBatteryPercentageReceive);
  zbGateway.onOnOffCustomCmdReceive(Z2S_onOnOffCustomCmdReceive);
  zbGateway.onCmdCustomClusterReceive(Z2S_onCmdCustomClusterReceive);
  zbGateway.onIASzoneStatusChangeNotification(Z2S_onIASzoneStatusChangeNotification);
  zbGateway.onBoundDevice(Z2S_onBoundDevice);
  zbGateway.onBTCBoundDevice(Z2S_onBTCBoundDevice);

  zbGateway.setManufacturerAndModel("Supla", "Z2SGateway");
  zbGateway.allowMultipleBinding(true);

  Zigbee.addEndpoint(&zbGateway);
  Zigbee.setRebootOpenNetwork(kOpenNetworkSeconds);
}

void iterate() {
  if (zigbeeInitPending && SuplaDevice.getCurrentStatus() == STATUS_REGISTERED_AND_READY) {
    esp_coex_wifi_i154_enable();

    if (!Zigbee.begin(ZIGBEE_COORDINATOR)) {
      Serial.println("Zigbee failed to start, rebooting");
      ESP.restart();
    }

    zigbeeInitPending = false;
  }

  if (zigbeeInitPending) {
    return;
  }

  handleGatewayButton();
  processJoinedDevices();
}

}  // namespace ZigbeeGatewayMode
}  // namespace GUI
}  // namespace Supla

#endif
