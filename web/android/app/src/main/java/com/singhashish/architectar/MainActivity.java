package com.singhashish.architectar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.singhashish.architectar.ar.ArWalkthroughPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate(), as Capacitor's own docs
        // require -- registerPlugin() after the bridge has already
        // initialized silently no-ops.
        registerPlugin(ArWalkthroughPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
