package com.slackclone.config;

import com.slackclone.presence.dto.PresenceEvent;
import com.slackclone.presence.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@RequiredArgsConstructor
public class WebSocketPresenceListener {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        if (user != null) {
            presenceService.setOnline(user.getName());
            broadcastPresence(user.getName(), true);
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        if (user != null) {
            presenceService.setOffline(user.getName());
            broadcastPresence(user.getName(), false);
        }
    }

    private void broadcastPresence(String email, boolean online) {
        presenceService.getBroadcastInfo(email).ifPresent(info -> {
            PresenceEvent event = new PresenceEvent(info.userId().toString(), online);
            info.workspaceIds().forEach(wsId ->
                    messagingTemplate.convertAndSend(
                            "/topic/workspace/" + wsId + "/presence", event));
        });
    }
}
