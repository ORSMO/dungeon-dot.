package com.orsmo.dungeondot;

import android.app.Activity;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import java.util.Collections;

final class PreviewRewards {
    private static final String TEST_UNIT = "ca-app-pub-3940256099942544/5224354917";

    private final Activity activity;
    private boolean initialized;
    private boolean initializing;
    private boolean showing;
    private Pending pending;

    private record Pending(String id, JavaScriptReplyProxy reply) {}

    private PreviewRewards(Activity activity) {
        this.activity = activity;
    }

    static void attach(Activity activity, WebView game, String origin, String entryPage) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        PreviewRewards rewards = new PreviewRewards(activity);
        WebViewCompat.addWebMessageListener(game, "DungeonDotPreview", Collections.singleton(origin),
                (view, message, source, mainFrame, reply) -> {
                    if (!mainFrame || !entryPage.equals(view.getUrl())) return;
                    String id = message.getData();
                    if (id == null) return;
                    if (id.matches("[0-9]{1,12}")) rewards.request(new Pending(id, reply));
                    if (id.startsWith("cancel:")) rewards.cancel(id.substring(7));
                });
    }

    private void request(Pending request) {
        if (pending != null || activity.isFinishing() || activity.isDestroyed()) {
            request.reply().postMessage(request.id() + ":unavailable");
            return;
        }
        pending = request;
        if (initialized) {
            load(request);
            return;
        }
        if (initializing) return;
        initializing = true;
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE)
                .build());
        MobileAds.initialize(activity, status -> activity.runOnUiThread(() -> {
            initialized = true;
            initializing = false;
            if (pending != null) load(pending);
        }));
    }

    private void cancel(String id) {
        if (!showing && pending != null && pending.id().equals(id)) pending = null;
    }

    private void load(Pending request) {
        if (activity.isFinishing() || activity.isDestroyed()) {
            complete(request, "unavailable");
            return;
        }
        RewardedAd.load(activity, TEST_UNIT, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                if (request != pending) return;
                if (activity.isFinishing() || activity.isDestroyed()) {
                    complete(request, "unavailable");
                    return;
                }
                show(ad, request);
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError error) {
                complete(request, "unavailable");
            }
        });
    }

    private void show(RewardedAd ad, Pending request) {
        showing = true;
        // The Google test ad reports its reward before the full-screen dismissal callback.
        boolean[] earned = {false};
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                complete(request, earned[0] ? "earned" : "skipped");
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                complete(request, "unavailable");
            }
        });
        ad.show(activity, reward -> earned[0] = true);
    }

    private void complete(Pending request, String result) {
        if (request != pending) return;
        pending = null;
        showing = false;
        if (!activity.isDestroyed()) request.reply().postMessage(request.id() + ":" + result);
    }
}
