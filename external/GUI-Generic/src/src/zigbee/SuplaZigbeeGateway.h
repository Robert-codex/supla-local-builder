#ifndef SRC_ZIGBEE_SUPLAZIGBEEGATEWAY_H_
#define SRC_ZIGBEE_SUPLAZIGBEEGATEWAY_H_

#if defined(SUPLA_ZIGBEE_GATEWAY) && defined(CONFIG_IDF_TARGET_ESP32C6)

namespace Supla {
namespace GUI {
namespace ZigbeeGatewayMode {

void setup();
void iterate();

}  // namespace ZigbeeGatewayMode
}  // namespace GUI
}  // namespace Supla

#endif

#endif  // SRC_ZIGBEE_SUPLAZIGBEEGATEWAY_H_
