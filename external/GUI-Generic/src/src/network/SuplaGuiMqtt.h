#ifndef SRC_NETWORK_SUPLAGUIMQTT_H_
#define SRC_NETWORK_SUPLAGUIMQTT_H_

#ifdef ARDUINO_ARCH_ESP32

#include <mqtt_client.h>
#include <supla/mutex.h>
#include <supla/protocol/mqtt.h>

namespace Supla {
namespace GUI {

class MqttClient : public Supla::Protocol::Mqtt {
 public:
  explicit MqttClient(SuplaDeviceClass *sdc);
  ~MqttClient() override;

  void onInit() override;
  void disconnect() override;
  bool iterate(uint32_t millis) override;

  void setConnecting();
  void setConnectionError();
  void setRegisteredAndReady();

  static Supla::Mutex *mutex;
  static Supla::Mutex *mutexEventHandler;

 protected:
  void publishImp(const char *topic,
                  const char *payload,
                  int qos,
                  bool retain) override;
  void subscribeImp(const char *topic, int qos) override;

 private:
  void publishChannelSetup(int channelNumber);

  bool started = false;
  bool enterRegisteredAndReady = false;
  esp_mqtt_client_handle_t client = {};
  uint32_t lastStatusUpdateSec = 0;
};

}  // namespace GUI
}  // namespace Supla

#endif

#endif  // SRC_NETWORK_SUPLAGUIMQTT_H_
