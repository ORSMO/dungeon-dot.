package com.orsmo.dungeondot;

import android.app.Activity;
import android.webkit.WebView;

final class PreviewRewards {
    private PreviewRewards() {}

    static void attach(Activity activity, WebView game, String origin, String entryPage) {
        // The production activity bundles the offline game without a reward bridge.
    }
}
