package net.madtrix.grimoire.companion;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local : découverte mDNS des tables Grimoire sur le Wi-Fi
        registerPlugin(TableDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
