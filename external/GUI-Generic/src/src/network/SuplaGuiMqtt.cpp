#include "SuplaGuiMqtt.h"

#ifdef ARDUINO_ARCH_ESP32

#include <string.h>
#include <SuplaDevice.h>
#include <supla/auto_lock.h>
#include <supla/log_wrapper.h>
#include <supla/storage/config.h>

namespace Supla {
namespace {
enum MqttStatus {
  MqttStatusNone,
  MqttStatusTransportError,
  MqttStatusBadProtocol,
  MqttStatusServerUnavailable,
  MqttStatusBadUsernameOrPassword,
  MqttStatusNotAuthorized,
  MqttStatusConnectionRefused,
  MqttStatusUnknownConnectionError,
  MqttStatusConnected
};

MqttStatus lastError = MqttStatusNone;
Supla::GUI::MqttClient *mqttInstance = nullptr;

void processMqttEventData(esp_mqtt_event_handle_t event) {
  if (event == nullptr || mqttInstance == nullptr) {
    return;
  }

  char topic[MAX_TOPIC_LEN] = {};
  char payload[MQTT_MAX_PAYLOAD_LEN] = {};
  int topicLen = MAX_TOPIC_LEN;
  if (event->topic_len < topicLen) {
    topicLen = event->topic_len;
  }
  int payloadLen = MQTT_MAX_PAYLOAD_LEN - 1;
  if (event->data_len < payloadLen) {
    payloadLen = event->data_len;
  }

  strncpy(topic, event->topic, topicLen);
  strncpy(payload, event->data, payloadLen);
  mqttInstance->processData(topic, payload);
}

void mqttEventHandler(void *handlerArgs,
                      esp_event_base_t base,
                      int32_t eventId,
                      void *eventData) {
  (void)handlerArgs;
  if (mqttInstance == nullptr) {
    return;
  }
  SUPLA_LOG_DEBUG("MQTT event base=%s id=%d", base, eventId);

  Supla::AutoLock eventHandlerLock(Supla::GUI::MqttClient::mutexEventHandler);
  Supla::AutoLock autoLock(Supla::GUI::MqttClient::mutex);

  auto event = reinterpret_cast<esp_mqtt_event_handle_t>(eventData);
  switch (static_cast<esp_mqtt_event_id_t>(eventId)) {
    case MQTT_EVENT_BEFORE_CONNECT:
      mqttInstance->setConnecting();
      break;
    case MQTT_EVENT_CONNECTED:
      if (lastError != MqttStatusConnected) {
        lastError = MqttStatusConnected;
        mqttInstance->getSdc()->addLastStateLog("MQTT: connected");
      }
      mqttInstance->setRegisteredAndReady();
      break;
    case MQTT_EVENT_DISCONNECTED:
      mqttInstance->setConnecting();
      break;
    case MQTT_EVENT_DATA:
      processMqttEventData(event);
      break;
    case MQTT_EVENT_ERROR:
      mqttInstance->setConnectionError();
      if (event == nullptr || event->error_handle == nullptr) {
        break;
      }

      if (
#ifdef MQTT_ERROR_TYPE_TCP_TRANSPORT
          event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT ||
#endif
          event->error_handle->error_type == MQTT_ERROR_TYPE_ESP_TLS) {
        if (lastError != MqttStatusTransportError) {
          lastError = MqttStatusTransportError;
          mqttInstance->getSdc()->addLastStateLog(
              "MQTT: failed to establish connection");
        }
      } else if (event->error_handle->error_type ==
                 MQTT_ERROR_TYPE_CONNECTION_REFUSED) {
        switch (event->error_handle->connect_return_code) {
          case MQTT_CONNECTION_REFUSE_PROTOCOL:
            if (lastError != MqttStatusBadProtocol) {
              lastError = MqttStatusBadProtocol;
              mqttInstance->getSdc()->addLastStateLog(
                  "MQTT: connection refused (bad protocol)");
            }
            break;
          case MQTT_CONNECTION_REFUSE_SERVER_UNAVAILABLE:
            if (lastError != MqttStatusServerUnavailable) {
              lastError = MqttStatusServerUnavailable;
              mqttInstance->getSdc()->addLastStateLog(
                  "MQTT: connection refused (server unavailable)");
            }
            break;
          case MQTT_CONNECTION_REFUSE_BAD_USERNAME:
            if (lastError != MqttStatusBadUsernameOrPassword) {
              lastError = MqttStatusBadUsernameOrPassword;
              mqttInstance->getSdc()->addLastStateLog(
                  "MQTT: connection refused (bad username or password)");
            }
            break;
          case MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED:
            if (lastError != MqttStatusNotAuthorized) {
              lastError = MqttStatusNotAuthorized;
              mqttInstance->getSdc()->addLastStateLog(
                  "MQTT: connection refused (not authorized)");
            }
            break;
          default:
            if (lastError != MqttStatusConnectionRefused) {
              lastError = MqttStatusConnectionRefused;
              mqttInstance->getSdc()->addLastStateLog(
                  "MQTT: connection refused");
            }
            break;
        }
      } else if (lastError != MqttStatusUnknownConnectionError) {
        lastError = MqttStatusUnknownConnectionError;
        mqttInstance->getSdc()->addLastStateLog("MQTT: other connection error");
      }
      break;
    default:
      break;
  }
}
}  // namespace

Supla::Mutex *Supla::GUI::MqttClient::mutex = nullptr;
Supla::Mutex *Supla::GUI::MqttClient::mutexEventHandler = nullptr;

Supla::GUI::MqttClient::MqttClient(SuplaDeviceClass *sdc)
    : Supla::Protocol::Mqtt(sdc) {
  mqttInstance = this;
}

Supla::GUI::MqttClient::~MqttClient() {
  mqttInstance = nullptr;
}

void Supla::GUI::MqttClient::onInit() {
  if (mutex == nullptr) {
    mutex = Supla::Mutex::Create();
    mutex->lock();
    mutexEventHandler = Supla::Mutex::Create();
  }

  if (!isEnabled()) {
    return;
  }

  Supla::Protocol::Mqtt::onInit();

  esp_mqtt_client_config_t mqttCfg = {};
  char clientId[MQTT_CLIENTID_MAX_SIZE] = {};
  generateClientId(clientId);

  MqttTopic lastWill(prefix);
  lastWill = lastWill / "state" / "connected";

  mqttCfg.broker.address.hostname = server;
  mqttCfg.broker.address.port = port;
  mqttCfg.broker.address.transport =
      useTls ? MQTT_TRANSPORT_OVER_SSL : MQTT_TRANSPORT_OVER_TCP;
  mqttCfg.session.keepalive = sdc->getActivityTimeout();
  mqttCfg.session.last_will.topic = lastWill.c_str();
  mqttCfg.session.last_will.msg = "false";
  mqttCfg.session.last_will.retain = 1;
  mqttCfg.credentials.client_id = clientId;

  if (useAuth) {
    mqttCfg.credentials.username = user;
    mqttCfg.credentials.authentication.password = password;
  }

  client = esp_mqtt_client_init(&mqttCfg);
  esp_mqtt_client_register_event(
      client, MQTT_EVENT_ANY, mqttEventHandler, nullptr);
}

void Supla::GUI::MqttClient::disconnect() {
  if (!isEnabled()) {
    return;
  }

  if (started) {
    if (lastError == MqttStatusConnected) {
      mutex->unlock();
      esp_mqtt_client_stop(client);
      started = false;
    } else {
      esp_mqtt_client_disconnect(client);
      mutex->unlock();
      esp_mqtt_client_stop(client);
      started = false;
    }

    esp_mqtt_client_destroy(client);
    onInit();
    mutex->lock();
  }

  enterRegisteredAndReady = false;
}

void Supla::GUI::MqttClient::publishChannelSetup(int channelNumber) {
  if (channelNumber < 0 || channelNumber >= channelsCount) {
    return;
  }

  publishHADiscovery(channelNumber);
  subscribeChannel(channelNumber);
  publishChannelState(channelNumber);
  configChangedBit[channelNumber / 8] &= ~(1 << (channelNumber % 8));
}

bool Supla::GUI::MqttClient::iterate(uint32_t millis) {
  if (!isEnabled()) {
    return false;
  }

  uptime.iterate(millis);

  if (!started) {
    started = true;
    enterRegisteredAndReady = false;
    esp_mqtt_client_start(client);
    return false;
  }

  mutex->unlock();
  mutexEventHandler->lock();
  mutex->lock();
  mutexEventHandler->unlock();

  if (!connected) {
    return false;
  }

  if (enterRegisteredAndReady) {
    enterRegisteredAndReady = false;
    publishDeviceStatus(true);
    lastStatusUpdateSec = uptime.getConnectionUptime();

    for (int i = 0; i < channelsCount; i++) {
      publishChannelSetup(i);
    }
  }

  bool anyConfigChanged = false;
  for (unsigned int i = 0;
       i < sizeof(configChangedBit) / sizeof(configChangedBit[0]);
       i++) {
    if (configChangedBit[i] != 0) {
      anyConfigChanged = true;
      break;
    }
  }

  if (anyConfigChanged) {
    for (int i = 0; i < channelsCount; i++) {
      if (configChangedBit[i / 8] & (1 << (i % 8))) {
        publishChannelSetup(i);
      }
    }
  }

  if (uptime.getConnectionUptime() - lastStatusUpdateSec >= 5) {
    lastStatusUpdateSec = uptime.getConnectionUptime();
    publishDeviceStatus(false);
  }

  return true;
}

void Supla::GUI::MqttClient::setConnecting() {
  connecting = true;
  connected = false;
  enterRegisteredAndReady = false;
}

void Supla::GUI::MqttClient::setConnectionError() {
  error = true;
  connected = false;
  enterRegisteredAndReady = false;
}

void Supla::GUI::MqttClient::setRegisteredAndReady() {
  connecting = false;
  connected = true;
  error = false;
  enterRegisteredAndReady = true;
  uptime.resetConnectionUptime();
  lastStatusUpdateSec = 0;
  memset(configChangedBit, 0, sizeof(configChangedBit));
}

void Supla::GUI::MqttClient::publishImp(const char *topic,
                                        const char *payload,
                                        int qos,
                                        bool retain) {
  if (!connected) {
    return;
  }

  mutex->unlock();
  esp_mqtt_client_publish(client, topic, payload, 0, qos, retain ? 1 : 0);
  mutex->lock();
}

void Supla::GUI::MqttClient::subscribeImp(const char *topic, int qos) {
  if (!connected) {
    return;
  }

  mutex->unlock();
  esp_mqtt_client_subscribe(client, topic, qos);
  mutex->lock();
}

}  // namespace Supla

#endif
