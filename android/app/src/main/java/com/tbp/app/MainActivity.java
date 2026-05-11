package com.tbp.app;

import com.getcapacitor.BridgeActivity;
import com.ionicframework.capacitor.Checkout;

import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(Checkout.class);
    }
}
