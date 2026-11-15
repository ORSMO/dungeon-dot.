package com.orsmo.dungeondot;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ENTRY_PAGE = "https://" + HOST + "/assets/index.html";
    private static final int BACKGROUND = Color.rgb(17, 16, 26);

    private FrameLayout container;
    private WebView game;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        container = new FrameLayout(this);
        container.setBackgroundColor(BACKGROUND);
        if (Build.VERSION.SDK_INT >= 28) {
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                DisplayCutout cutout = insets.getDisplayCutout();
                if (cutout != null) {
                    view.setPadding(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(),
                            cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
                } else {
                    view.setPadding(0, 0, 0, 0);
                }
                return insets;
            });
        }
        setContentView(container);
        openGame();
        hideSystemBars();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void openGame() {
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        game = new WebView(this);
        game.setBackgroundColor(BACKGROUND);
        game.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Only the bundled game can load. No JavaScript bridge is exposed.
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        game.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isBundledAsset(request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isBundledAsset(request.getUrl())) {
                    WebResourceResponse asset = loader.shouldInterceptRequest(request.getUrl());
                    if (asset != null) {
                        return asset;
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (ENTRY_PAGE.equals(url)) {
                    // The activity already opens the game in immersive mode.
                    view.evaluateJavascript(
                            "document.querySelector('#fullscreen-toggle').style.display = 'none';",
                            null
                    );
                }
            }
        });
        container.addView(game, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        game.loadUrl(ENTRY_PAGE);
    }

    private static boolean isBundledAsset(Uri url) {
        return "https".equals(url.getScheme()) && HOST.equals(url.getHost())
                && url.getPort() == -1 && url.getPath() != null
                && url.getPath().startsWith("/assets/");
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @Override
    protected void onPause() {
        game.onPause();
        game.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        game.resumeTimers();
        game.onResume();
    }

    @Override
    protected void onDestroy() {
        container.removeView(game);
        game.destroy();
        super.onDestroy();
    }
}
