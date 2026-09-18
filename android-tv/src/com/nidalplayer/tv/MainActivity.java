package com.nidalplayer.tv;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.inputmethod.InputMethodManager;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.SeekParameters;
import com.google.android.exoplayer2.extractor.DefaultExtractorsFactory;
import com.google.android.exoplayer2.extractor.ts.DefaultTsPayloadReaderFactory;
import com.google.android.exoplayer2.extractor.ts.TsExtractor;
import com.google.android.exoplayer2.extractor.mp4.Mp4Extractor;
import com.google.android.exoplayer2.extractor.mkv.MatroskaExtractor;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.video.VideoSize;
import com.google.android.exoplayer2.Tracks;
import com.google.android.exoplayer2.trackselection.TrackSelectionOverride;
import com.google.android.exoplayer2.trackselection.TrackSelectionParameters;

import java.net.*;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final String TAG = "NidalPlayerTV";
    private static MainActivity sInstance;
    private WebView mWebView;
    private EmbeddedServer mServer;
    private String mLocalIp = "127.0.0.1";
    private String mRemoteToken = "";
    private volatile boolean mPageLoaded = false;
    private volatile String mPendingPlaylistImport = null;
    private PermissionRequest mPendingCameraPermissionRequest;
    private int mLastDpadCode = -1;
    private long mLastDpadDispatchAt = 0L;

    // Native ExoPlayer hardware preview with True 16:9 Aspect Ratio
    private ExoPlayer mPreviewPlayer;
    private android.view.TextureView mPreviewSurface;
    private FrameLayout mPreviewContainer;
    private FrameLayout.LayoutParams mPreviewBoxParams;
    private boolean mIsPreviewFullscreen = false;
    private FrameLayout mPreviewOverlay;
    private LinearLayout mPreviewTopBar;
    private TextView mPreviewTitleText;
    private TextView mPreviewStatusText;
    private TextView mPreviewCodecBadge;
    private String mCurrentPreviewTitle = "Live TV Channel";
    private String mCurrentPreviewCategory = "All Channels";
    private SeekBar mPreviewSeekBar;
    private TextView mPreviewCurrentTime;
    private TextView mPreviewDurationTime;
    private TextView mPreviewRewindButton;
    private TextView mPreviewPlayPauseButton;
    private TextView mPreviewForwardButton;
    private TextView mPreviewAspectButton;
    private TextView mPreviewAudioButton;
    private TextView mPreviewSubButton;
    private TextView mPreviewVlcButton;
    private TextView mPreviewExitButton;
    private TextView[] mPreviewButtons;
    private int mSelectedAudioIndex = 0;
    private int mSelectedSubIndex = -1;
    private String mPreviewStreamUrl = "";
    private boolean mPreviewFillMode = false;
    private Handler mPreviewUiHandler;
    private Runnable mPreviewUiRunnable;
    private Runnable mPreviewHideRunnable;
    private boolean mPreviewOverlayHidden = false;
    private static final long PREVIEW_OSD_HIDE_DELAY_MS = 3500L;
    private int mLastVideoWidth = 1920;
    private int mLastVideoHeight = 1080;
    private String mCurrentPreviewItemId = "";
    private long mCurrentPreviewStartSeekMs = 0;
    private WebAppInterface mWebAppInterface;
    private volatile boolean mKeyboardOpen = false;
    private volatile boolean mHandlingKeyboardBack = false;

    // Coalesce high-frequency WebView layout updates so the Android UI thread
    // applies only the newest preview bounds instead of building a runnable
    // backlog during the sidebar transition.
    private final Object mPreviewBoundsLock = new Object();
    private float mPendingPreviewLeft;
    private float mPendingPreviewTop;
    private float mPendingPreviewWidth;
    private float mPendingPreviewHeight;
    private float mPendingPreviewWindowWidth;
    private float mPendingPreviewWindowHeight;
    private boolean mPreviewBoundsApplyPosted = false;

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 4101 && mPendingCameraPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                mPendingCameraPermissionRequest.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
            } else {
                mPendingCameraPermissionRequest.deny();
                if (mWebView != null) {
                    mWebView.evaluateJavascript("window.onQrCameraPermissionDenied && window.onQrCameraPermissionDenied();", null);
                }
            }
            mPendingCameraPermissionRequest = null;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sInstance = this;

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#080A0E"));

        // 1. WebView on root container
        WebView.setWebContentsDebuggingEnabled(true);
        mWebView = new WebView(this);
        mWebView.setBackgroundColor(Color.parseColor("#080A0E"));
        mWebView.setFocusable(true);
        mWebView.setFocusableInTouchMode(true);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        mWebAppInterface = new WebAppInterface();
        mWebView.addJavascriptInterface(mWebAppInterface, "AndroidBridge");
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Native 1080p Fixed Canvas Scaling for perfect TV fit across 720p, 1080p, and 4K displays
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setDefaultFontSize(16);

        settings.setUserAgentString("Mozilla/5.0 (Linux; Android TV; Nidalplayer/4.0.0) AppleWebKit/537.36 Chrome/110.0.0.0 Safari/537.36");

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS Console] " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (android.os.Build.VERSION.SDK_INT < 23
                                || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
                        } else {
                            mPendingCameraPermissionRequest = request;
                            requestPermissions(new String[] { Manifest.permission.CAMERA }, 4101);
                        }
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (mPendingCameraPermissionRequest == request) mPendingCameraPermissionRequest = null;
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Log.e(TAG, "WebView Error: " + errorCode + " " + description + " URL: " + failingUrl);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "WebView Page Loaded: " + url);
                mWebView.evaluateJavascript("window.setDeviceInfo && window.setDeviceInfo('" + mLocalIp + "', '" + mRemoteToken + "');", null);
                mPageLoaded = true;
                String pending = mPendingPlaylistImport;
                mPendingPlaylistImport = null;
                if (pending != null) {
                    mWebView.evaluateJavascript("window.importPlaylistFromPhone && window.importPlaylistFromPhone(" + pending + ");", null);
                }
                mWebView.requestFocus();
            }
        });

        root.addView(mWebView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // 2. Native Hardware Preview Viewport placed ON TOP of mWebView in preview dock
        mPreviewContainer = new FrameLayout(this);
        mPreviewContainer.setBackgroundColor(Color.BLACK);
        mPreviewContainer.setFocusable(false);
        mPreviewContainer.setClickable(false);
        mPreviewContainer.setOutlineProvider(new ViewOutlineProvider() {
            @Override
            public void getOutline(View view, Outline outline) {
                if (mIsPreviewFullscreen) {
                    outline.setRect(0, 0, view.getWidth(), view.getHeight());
                } else {
                    float radius = getResources().getDisplayMetrics().density * 12f;
                    outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), radius);
                }
            }
        });
        mPreviewContainer.setClipToOutline(true);

        mPreviewSurface = new android.view.TextureView(this);
        mPreviewSurface.setFocusable(false);
        mPreviewSurface.setClickable(false);
        mPreviewContainer.addView(mPreviewSurface, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
        ));
        mPreviewContainer.setVisibility(View.GONE);
        root.addView(mPreviewContainer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        buildNativePreviewOverlay(root);
        setContentView(root);

        mPreviewUiHandler = new Handler(getMainLooper());
        mPreviewUiRunnable = new Runnable() {
            @Override public void run() {
                updateNativePreviewOverlay();
                if (mIsPreviewFullscreen && mPreviewUiHandler != null) {
                    mPreviewUiHandler.postDelayed(this, 500);
                }
            }
        };
        mPreviewHideRunnable = new Runnable() {
            @Override public void run() {
                if (mIsPreviewFullscreen && mPreviewOverlay != null && !mPreviewSeekBar.isPressed()) {
                    mPreviewOverlayHidden = true;
                    mPreviewOverlay.setVisibility(View.INVISIBLE);
                    Log.d(TAG, "Preview fullscreen OSD hidden after inactivity");
                }
            }
        };

        mLocalIp = getDeviceIpAddress();
        android.content.SharedPreferences prefs = getSharedPreferences("nidalplayer_tv_prefs", MODE_PRIVATE);
        mRemoteToken = prefs.getString("remote_pairing_token", null);
        if (mRemoteToken == null || mRemoteToken.isEmpty()) {
            mRemoteToken = "np" + Long.toHexString(System.currentTimeMillis()).substring(4);
            prefs.edit().putString("remote_pairing_token", mRemoteToken).apply();
        }
        Log.i(TAG, "Android TV Persistent Pairing Token: " + mRemoteToken + " (Local IP: " + mLocalIp + ")");

        // Start embedded HTTP server for independent Smartphone Remote & Fast Connect
        try {
            mServer = new EmbeddedServer(8765, mRemoteToken, this);
            mServer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }

        mWebView.loadUrl("file:///android_asset/www/index.html");
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private TextView makePreviewControl(String label) {
        TextView button = new TextView(this);
        button.setText(label);
        button.setTextColor(Color.parseColor("#E2E8F0"));
        button.setTextSize(12f);
        button.setTypeface(null, android.graphics.Typeface.BOLD);
        button.setSingleLine(true);
        button.setMaxLines(1);
        button.setEllipsize(android.text.TextUtils.TruncateAt.END);
        button.setIncludeFontPadding(false);
        button.setGravity(Gravity.CENTER);
        button.setFocusable(true);
        button.setFocusableInTouchMode(true);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        int padH = dpToPx(8);
        int padV = dpToPx(10);
        button.setPadding(padH, padV, padH, padV);
        GradientDrawable normal = new GradientDrawable();
        normal.setColor(Color.parseColor("#1E293B"));
        normal.setCornerRadius(dpToPx(8));
        normal.setStroke(dpToPx(1), Color.parseColor("#334155"));
        button.setBackground(normal);
        button.setOnFocusChangeListener((v, hasFocus) -> {
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(hasFocus ? Color.parseColor("#FF5500") : Color.parseColor("#1E293B"));
            bg.setCornerRadius(dpToPx(8));
            bg.setStroke(hasFocus ? dpToPx(2) : dpToPx(1), hasFocus ? Color.WHITE : Color.parseColor("#334155"));
            button.setBackground(bg);
            button.setTextColor(hasFocus ? Color.WHITE : Color.parseColor("#E2E8F0"));
        });
        return button;
    }

    private LinearLayout.LayoutParams previewButtonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        params.setMargins(dpToPx(4), 0, dpToPx(4), 0);
        return params;
    }

    private boolean isPreviewControl(View view) {
        if (view == null) return false;
        if (view == mPreviewSeekBar) return true;
        if (mPreviewButtons == null) return false;
        for (TextView button : mPreviewButtons) if (view == button) return true;
        return false;
    }

    private int previewButtonIndex(View view) {
        if (mPreviewButtons == null || view == null) return -1;
        for (int i = 0; i < mPreviewButtons.length; i++) if (view == mPreviewButtons[i]) return i;
        return -1;
    }

    private String formatPreviewTime(long millis) {
        if (millis < 0) millis = 0;
        long totalSeconds = millis / 1000;
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;
        return String.format(Locale.getDefault(), "%02d:%02d:%02d", hours, minutes, seconds);
    }

    private void togglePreviewAspectRatio() {
        if (mPreviewContainer == null || mPreviewSurface == null) return;
        mPreviewFillMode = !mPreviewFillMode;
        if (mPreviewFillMode) {
            mPreviewSurface.setLayoutParams(new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER));
            if (mPreviewAspectButton != null) mPreviewAspectButton.setText("FIT");
        } else {
            applyPreviewAspectRatio(mLastVideoWidth, mLastVideoHeight);
            if (mPreviewAspectButton != null) mPreviewAspectButton.setText("FILL");
        }
    }

    private void openPreviewExternalPlayer() {
        if (mPreviewStreamUrl == null || mPreviewStreamUrl.trim().isEmpty()) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(mPreviewStreamUrl), "video/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(Intent.createChooser(intent, "Play Stream With..."));
        } catch (Exception e) {
            Log.e(TAG, "Preview external player launch failed: " + e.getMessage());
        }
    }

    private void cycleAudioTrack() {
        if (mPreviewPlayer == null) return;
        try {
            Tracks tracks = mPreviewPlayer.getCurrentTracks();
            List<Tracks.Group> audioGroups = new java.util.ArrayList<>();
            for (Tracks.Group group : tracks.getGroups()) {
                if (group.getType() == C.TRACK_TYPE_AUDIO) {
                    audioGroups.add(group);
                }
            }
            if (audioGroups.isEmpty()) {
                if (mPreviewAudioButton != null) mPreviewAudioButton.setText("🎵 DEFAULT");
                return;
            }
            mSelectedAudioIndex = (mSelectedAudioIndex + 1) % audioGroups.size();
            Tracks.Group selectedGroup = audioGroups.get(mSelectedAudioIndex);
            TrackSelectionOverride override = new TrackSelectionOverride(selectedGroup.getMediaTrackGroup(), 0);
            TrackSelectionParameters params = mPreviewPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
                    .addOverride(override)
                    .build();
            mPreviewPlayer.setTrackSelectionParameters(params);

            String lang = selectedGroup.getTrackFormat(0).language;
            if (lang == null || lang.isEmpty()) lang = "TRACK " + (mSelectedAudioIndex + 1);
            if (mPreviewAudioButton != null) mPreviewAudioButton.setText("🎵 " + lang.toUpperCase(Locale.ROOT));
            Log.i(TAG, "ExoPlayer cycled to audio track: " + lang);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cycle audio track: " + e.getMessage());
        }
    }

    private void cycleSubtitleTrack() {
        if (mPreviewPlayer == null) return;
        try {
            Tracks tracks = mPreviewPlayer.getCurrentTracks();
            List<Tracks.Group> textGroups = new java.util.ArrayList<>();
            for (Tracks.Group group : tracks.getGroups()) {
                if (group.getType() == C.TRACK_TYPE_TEXT) {
                    textGroups.add(group);
                }
            }
            if (textGroups.isEmpty()) {
                if (mPreviewSubButton != null) mPreviewSubButton.setText("💬 NO SUBS");
                return;
            }
            mSelectedSubIndex++;
            if (mSelectedSubIndex >= textGroups.size()) {
                mSelectedSubIndex = -1; // wrap around to OFF
            }

            TrackSelectionParameters.Builder builder = mPreviewPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_TEXT);

            if (mSelectedSubIndex == -1) {
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
                if (mPreviewSubButton != null) mPreviewSubButton.setText("💬 SUB OFF");
                Log.i(TAG, "ExoPlayer disabled subtitles");
            } else {
                Tracks.Group selectedGroup = textGroups.get(mSelectedSubIndex);
                TrackSelectionOverride override = new TrackSelectionOverride(selectedGroup.getMediaTrackGroup(), 0);
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false);
                builder.addOverride(override);
                String lang = selectedGroup.getTrackFormat(0).language;
                if (lang == null || lang.isEmpty()) lang = "SUB " + (mSelectedSubIndex + 1);
                if (mPreviewSubButton != null) mPreviewSubButton.setText("💬 " + lang.toUpperCase(Locale.ROOT));
                Log.i(TAG, "ExoPlayer enabled subtitle: " + lang);
            }
            mPreviewPlayer.setTrackSelectionParameters(builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Failed to cycle subtitle track: " + e.getMessage());
        }
    }

    private String getPreviewLocalizedStatus(String category) {
        String lang = getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE).getString("app_lang", "en");
        String cat = (category != null && !category.isEmpty()) ? category : "All";
        if ("fr".equals(lang)) {
            return "TÉLÉ EN DIRECT  |  " + cat + "  |  [OK] Menu  |  [RETOUR] Quitter";
        } else if ("ar".equals(lang)) {
            return "بث مباشر  |  " + cat + "  |  [OK] القائمة  |  [BACK] رجوع";
        } else if ("es".equals(lang)) {
            return "TV EN VIVO  |  " + cat + "  |  [OK] Menú  |  [VOLVER] Salir";
        } else if ("de".equals(lang)) {
            return "LIVE-TV  |  " + cat + "  |  [OK] Menü  |  [ZURÜCK] Beenden";
        }
        return "LIVE TV  |  " + cat + "  |  [OK] Show Menu  |  [BACK] Return";
    }

    private void buildNativePreviewOverlay(FrameLayout root) {
        mPreviewOverlay = new FrameLayout(this);
        mPreviewOverlay.setVisibility(View.GONE);
        mPreviewOverlay.setFocusable(true);
        mPreviewOverlay.setFocusableInTouchMode(true);
        mPreviewOverlay.setDescendantFocusability(android.view.ViewGroup.FOCUS_AFTER_DESCENDANTS);
        mPreviewOverlay.setClickable(false);
        mPreviewOverlay.setBackgroundColor(Color.TRANSPARENT);

        // --- TOP HEADER BAR (with TV Overscan Safe Margins) ---
        mPreviewTopBar = new LinearLayout(this);
        mPreviewTopBar.setOrientation(LinearLayout.HORIZONTAL);
        mPreviewTopBar.setGravity(Gravity.CENTER_VERTICAL);
        int topPadH = dpToPx(20);
        int topPadV = dpToPx(12);
        mPreviewTopBar.setPadding(topPadH, topPadV, topPadH, topPadV);
        GradientDrawable topBg = new GradientDrawable();
        topBg.setColor(Color.parseColor("#E6080A0E"));
        topBg.setCornerRadius(dpToPx(12));
        mPreviewTopBar.setBackground(topBg);

        LinearLayout titleBox = new LinearLayout(this);
        titleBox.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tbp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        titleBox.setLayoutParams(tbp);

        mPreviewTitleText = new TextView(this);
        mPreviewTitleText.setTextColor(Color.WHITE);
        mPreviewTitleText.setTextSize(20f);
        mPreviewTitleText.setTypeface(null, android.graphics.Typeface.BOLD);
        mPreviewTitleText.setSingleLine(true);
        mPreviewTitleText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        mPreviewTitleText.setText(mCurrentPreviewTitle);
        titleBox.addView(mPreviewTitleText);

        mPreviewStatusText = new TextView(this);
        mPreviewStatusText.setTextColor(Color.parseColor("#FF6B3D"));
        mPreviewStatusText.setTextSize(12f);
        mPreviewStatusText.setTypeface(null, android.graphics.Typeface.BOLD);
        mPreviewStatusText.setSingleLine(true);
        mPreviewStatusText.setText(getPreviewLocalizedStatus(mCurrentPreviewCategory));
        titleBox.addView(mPreviewStatusText);

        mPreviewTopBar.addView(titleBox);

        mPreviewCodecBadge = new TextView(this);
        mPreviewCodecBadge.setText("HW HD");
        mPreviewCodecBadge.setTextColor(Color.parseColor("#4ade80"));
        mPreviewCodecBadge.setTextSize(11f);
        mPreviewCodecBadge.setTypeface(null, android.graphics.Typeface.BOLD);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.parseColor("#15803d33"));
        badgeBg.setCornerRadius(dpToPx(6));
        badgeBg.setStroke(dpToPx(1), Color.parseColor("#4ade8033"));
        mPreviewCodecBadge.setBackground(badgeBg);
        int badgePadH = dpToPx(10);
        int badgePadV = dpToPx(4);
        mPreviewCodecBadge.setPadding(badgePadH, badgePadV, badgePadH, badgePadV);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        mPreviewTopBar.addView(mPreviewCodecBadge, badgeParams);

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        topParams.setMargins(dpToPx(24), dpToPx(16), dpToPx(24), 0);
        mPreviewOverlay.addView(mPreviewTopBar, topParams);

        // --- BOTTOM OSD PANEL (with TV Overscan Safe Margins) ---
        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        int botPadH = dpToPx(20);
        int botPadV = dpToPx(16);
        bottom.setPadding(botPadH, botPadV, botPadH, botPadV);
        GradientDrawable botBg = new GradientDrawable();
        botBg.setColor(Color.parseColor("#E6080A0E"));
        botBg.setCornerRadius(dpToPx(12));
        bottom.setBackground(botBg);

        // Timeline / Seekbar row
        LinearLayout seekRow = new LinearLayout(this);
        seekRow.setOrientation(LinearLayout.HORIZONTAL);
        seekRow.setGravity(Gravity.CENTER_VERTICAL);

        mPreviewCurrentTime = new TextView(this);
        mPreviewCurrentTime.setTextColor(Color.WHITE);
        mPreviewCurrentTime.setTextSize(12f);
        mPreviewCurrentTime.setTypeface(null, android.graphics.Typeface.BOLD);
        mPreviewCurrentTime.setSingleLine(true);
        mPreviewCurrentTime.setGravity(Gravity.CENTER);
        mPreviewCurrentTime.setText("00:00:00");
        seekRow.addView(mPreviewCurrentTime, new LinearLayout.LayoutParams(dpToPx(72), LinearLayout.LayoutParams.WRAP_CONTENT));

        mPreviewSeekBar = new SeekBar(this);
        mPreviewSeekBar.setFocusable(true);
        mPreviewSeekBar.setFocusableInTouchMode(true);
        mPreviewSeekBar.setMax(1000);
        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(Color.parseColor("#FF5500"));
        thumb.setSize(dpToPx(16), dpToPx(16));
        thumb.setStroke(dpToPx(2), Color.WHITE);
        mPreviewSeekBar.setThumb(thumb);
        LinearLayout.LayoutParams seekParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        seekParams.setMargins(dpToPx(8), 0, dpToPx(8), 0);
        seekRow.addView(mPreviewSeekBar, seekParams);

        mPreviewDurationTime = new TextView(this);
        mPreviewDurationTime.setTextColor(Color.parseColor("#94A3B8"));
        mPreviewDurationTime.setTextSize(12f);
        mPreviewDurationTime.setTypeface(null, android.graphics.Typeface.BOLD);
        mPreviewDurationTime.setSingleLine(true);
        mPreviewDurationTime.setGravity(Gravity.CENTER);
        mPreviewDurationTime.setText("00:00:00");
        seekRow.addView(mPreviewDurationTime, new LinearLayout.LayoutParams(dpToPx(72), LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout.LayoutParams seekRowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        seekRowParams.setMargins(0, 0, 0, dpToPx(14));
        bottom.addView(seekRow, seekRowParams);

        // Buttons row
        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER_VERTICAL);

        mPreviewRewindButton = makePreviewControl("⏪ -10s");
        buttons.addView(mPreviewRewindButton, previewButtonParams());
        mPreviewRewindButton.setOnClickListener(v -> seekNativePreviewBy(-10000));

        mPreviewPlayPauseButton = makePreviewControl("⏸ PAUSE");
        buttons.addView(mPreviewPlayPauseButton, previewButtonParams());
        mPreviewPlayPauseButton.setOnClickListener(v -> {
            if (mPreviewPlayer != null) {
                if (mPreviewPlayer.isPlaying()) mPreviewPlayer.pause(); else mPreviewPlayer.play();
                updateNativePreviewOverlay();
            }
        });

        mPreviewForwardButton = makePreviewControl("⏩ +10s");
        buttons.addView(mPreviewForwardButton, previewButtonParams());
        mPreviewForwardButton.setOnClickListener(v -> seekNativePreviewBy(10000));

        mPreviewAspectButton = makePreviewControl("📺 ASPECT");
        buttons.addView(mPreviewAspectButton, previewButtonParams());
        mPreviewAspectButton.setOnClickListener(v -> togglePreviewAspectRatio());

        mPreviewAudioButton = makePreviewControl("🎵 AUDIO");
        buttons.addView(mPreviewAudioButton, previewButtonParams());
        mPreviewAudioButton.setOnClickListener(v -> cycleAudioTrack());

        mPreviewSubButton = makePreviewControl("💬 SUB");
        buttons.addView(mPreviewSubButton, previewButtonParams());
        mPreviewSubButton.setOnClickListener(v -> cycleSubtitleTrack());

        mPreviewVlcButton = makePreviewControl("⛶ VLC");
        buttons.addView(mPreviewVlcButton, previewButtonParams());
        mPreviewVlcButton.setOnClickListener(v -> openPreviewExternalPlayer());

        mPreviewExitButton = makePreviewControl("✖ EXIT");
        buttons.addView(mPreviewExitButton, previewButtonParams());
        mPreviewExitButton.setOnClickListener(v -> {
            exitNativePreviewFullscreenNow();
            postToWebView("if (window.onNativePreviewFullscreenClosed) window.onNativePreviewFullscreenClosed(); else if (window.closeFullscreen) window.closeFullscreen();");
        });

        bottom.addView(buttons);
        mPreviewButtons = new TextView[] {
                mPreviewRewindButton, mPreviewPlayPauseButton, mPreviewForwardButton,
                mPreviewAspectButton, mPreviewAudioButton, mPreviewSubButton,
                mPreviewVlcButton, mPreviewExitButton
        };

        FrameLayout.LayoutParams controlParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        controlParams.setMargins(dpToPx(24), 0, dpToPx(24), dpToPx(20));
        mPreviewOverlay.addView(bottom, controlParams);
        root.addView(mPreviewOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        mPreviewSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && mPreviewPlayer != null && mPreviewPlayer.getDuration() > 0) {
                    mPreviewPlayer.seekTo((long) (mPreviewPlayer.getDuration() * progress / 1000.0));
                }
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
    }

    private void showPreviewOverlayForInteraction() {
        if (!mIsPreviewFullscreen || mPreviewOverlay == null) return;
        mPreviewOverlayHidden = false;
        mPreviewOverlay.setVisibility(View.VISIBLE);
        mPreviewOverlay.bringToFront();
        if (!isPreviewControl(getCurrentFocus()) && mPreviewSeekBar != null) {
            mPreviewSeekBar.requestFocus();
        }
        schedulePreviewOverlayHide();
    }

    private void schedulePreviewOverlayHide() {
        if (!mIsPreviewFullscreen || mPreviewUiHandler == null || mPreviewHideRunnable == null) return;
        mPreviewUiHandler.removeCallbacks(mPreviewHideRunnable);
        mPreviewUiHandler.postDelayed(mPreviewHideRunnable, PREVIEW_OSD_HIDE_DELAY_MS);
    }

    private void exitNativePreviewFullscreenNow() {
        if (!mIsPreviewFullscreen) return;
        mIsPreviewFullscreen = false;
        if (mPreviewPlayer != null && mPreviewPlayer.getDuration() > 0) {
            notifyNativePreviewProgress(mPreviewPlayer.getCurrentPosition(), mPreviewPlayer.getDuration(), !mPreviewPlayer.isPlaying());
        }
        if (mPreviewUiHandler != null && mPreviewUiRunnable != null) {
            mPreviewUiHandler.removeCallbacks(mPreviewUiRunnable);
        }
        if (mPreviewUiHandler != null && mPreviewHideRunnable != null) {
            mPreviewUiHandler.removeCallbacks(mPreviewHideRunnable);
        }
        mPreviewOverlayHidden = false;
        if (mPreviewOverlay != null) mPreviewOverlay.setVisibility(View.GONE);
        if (mPreviewBoxParams != null && mPreviewContainer != null) {
            mPreviewContainer.setLayoutParams(mPreviewBoxParams);
            mPreviewContainer.setClipToOutline(true);
            mPreviewContainer.invalidateOutline();
            applyPreviewAspectRatio(mLastVideoWidth, mLastVideoHeight);
        }
        Log.d(TAG, "exitNativePreviewFullscreenNow: overlay closed; restored dock bounds immediately");
    }

    private void seekNativePreviewBy(long deltaMs) {
        if (mPreviewPlayer == null) return;
        long duration = mPreviewPlayer.getDuration();
        long target = Math.max(0, mPreviewPlayer.getCurrentPosition() + deltaMs);
        if (duration > 0) target = Math.min(duration, target);
        mPreviewPlayer.seekTo(target);
        updateNativePreviewOverlay();
    }

    private void updateNativePreviewOverlay() {
        if (!mIsPreviewFullscreen || mPreviewPlayer == null) return;
        long duration = mPreviewPlayer.getDuration();
        long current = mPreviewPlayer.getCurrentPosition();
        if (mPreviewSeekBar != null && duration > 0 && !mPreviewSeekBar.isPressed()) {
            mPreviewSeekBar.setProgress((int) Math.max(0, Math.min(1000, current * 1000.0 / duration)));
        }
        if (mPreviewCurrentTime != null) mPreviewCurrentTime.setText(formatPreviewTime(current));
        if (mPreviewDurationTime != null) mPreviewDurationTime.setText(duration > 0 ? formatPreviewTime(duration) : "LIVE");
        if (mPreviewPlayPauseButton != null) {
            mPreviewPlayPauseButton.setText(mPreviewPlayer.isPlaying() ? "Ⅱ  PAUSE" : "▶  PLAY");
        }
        notifyNativePreviewProgress(current, duration, !mPreviewPlayer.isPlaying());
    }

    private boolean handlePreviewDpad(int code) {
        if (mPreviewOverlay == null || mPreviewSeekBar == null) return true;
        showPreviewOverlayForInteraction();
        View focused = getCurrentFocus();
        Log.d(TAG, "Preview D-pad code=" + code + " before=" + (focused == null ? "null" : focused.getClass().getSimpleName()));
        if (!isPreviewControl(focused)) {
            mPreviewSeekBar.requestFocus();
            focused = mPreviewSeekBar;
            Log.d(TAG, "Preview focus recovered to seekbar");
        }

        if (code == KeyEvent.KEYCODE_DPAD_UP) {
            if (focused != mPreviewSeekBar) mPreviewSeekBar.requestFocus();
            return true;
        }
        if (code == KeyEvent.KEYCODE_DPAD_DOWN) {
            if (focused == mPreviewSeekBar && mPreviewButtons != null && mPreviewButtons.length > 0) {
                mPreviewButtons[0].requestFocus();
                Log.d(TAG, "Preview focus moved to button 0");
            }
            return true;
        }
        if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
            if (focused == mPreviewSeekBar) {
                seekNativePreviewBy(code == KeyEvent.KEYCODE_DPAD_RIGHT ? 10000 : -10000);
                return true;
            }
            int index = previewButtonIndex(focused);
            if (index >= 0 && mPreviewButtons != null) {
                int next = index + (code == KeyEvent.KEYCODE_DPAD_RIGHT ? 1 : -1);
                if (next >= 0 && next < mPreviewButtons.length) {
                    mPreviewButtons[next].requestFocus();
                    Log.d(TAG, "Preview focus moved button " + index + " -> " + next);
                }
            }
            return true;
        }
        return true;
    }

    public boolean isSoftKeyboardVisible() {
        return mKeyboardOpen || (mWebAppInterface != null && mWebAppInterface.mIsInputActive);
    }

    private void dispatchTvKey(final String key) {
        Log.i(TAG, "dispatchTvKey invoked with key=" + key);
        if (mWebView != null) {
            mWebView.post(new Runnable() {
                @Override
                public void run() {
                    mWebView.evaluateJavascript("window.dispatchTvKey && window.dispatchTvKey('" + key + "');", null);
                }
            });
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();

        // 1. Unified BACK / ESCAPE / BUTTON_B Handling
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE || code == KeyEvent.KEYCODE_BUTTON_B) {
            if (mIsPreviewFullscreen && mPreviewOverlay != null) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    exitNativePreviewFullscreenNow();
                    String closeJs = "if (window.onNativePreviewFullscreenClosed) window.onNativePreviewFullscreenClosed(); else if (window.closeFullscreen) window.closeFullscreen();";
                    if (mWebView != null) mWebView.evaluateJavascript(closeJs, null);
                }
                return true;
            }

            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                boolean wasKeyboardOpen = mKeyboardOpen || (mWebAppInterface != null && mWebAppInterface.mIsInputActive) || isSoftKeyboardVisible();
                try {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null && mWebView != null) {
                        imm.hideSoftInputFromWindow(mWebView.getWindowToken(), 0);
                    }
                } catch (Exception ignored) {}
                mKeyboardOpen = false;
                if (mWebAppInterface != null) mWebAppInterface.mIsInputActive = false;

                if (mWebView != null) {
                    mWebView.requestFocus();
                }

                if (wasKeyboardOpen) {
                    dispatchTvKey("KEYBOARD_BACK");
                } else {
                    dispatchTvKey("BACK");
                }
            }
            return true;
        }

        // When typing in an input field or when soft keyboard is open, allow IME and WebView to handle all keys naturally
        if ((mWebAppInterface != null && mWebAppInterface.mIsInputActive) || isSoftKeyboardVisible()) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (mIsPreviewFullscreen && mPreviewOverlay != null) {
                if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER
                        || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_BUTTON_A) {
                    showPreviewOverlayForInteraction();
                    View focused = getCurrentFocus();
                    if (focused != null && focused != mPreviewOverlay) {
                        focused.performClick();
                    }
                    return true;
                }
                if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT
                        || code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN) {
                    return handlePreviewDpad(code);
                }
            }

            // If an input is currently active or software keyboard is showing:
            if (isSoftKeyboardVisible()) {
                // Allow the software keyboard and WebView to process DPAD, ENTER, typing, etc.
                return super.dispatchKeyEvent(event);
            }

            // Text input editing keys: forward explicitly to the focused WebView input.
            if (code == KeyEvent.KEYCODE_DEL || code == KeyEvent.KEYCODE_FORWARD_DEL) {
                dispatchTvKey(code == KeyEvent.KEYCODE_FORWARD_DEL ? "FORWARD_DELETE" : "DELETE");
                return true;
            }

            if (code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN
                    || code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
                if (event.getRepeatCount() > 0) return true;
                long now = SystemClock.uptimeMillis();
                if (code == mLastDpadCode && now - mLastDpadDispatchAt < 90L) return true;
                mLastDpadCode = code;
                mLastDpadDispatchAt = now;
                if (code == KeyEvent.KEYCODE_DPAD_UP) dispatchTvKey("UP");
                else if (code == KeyEvent.KEYCODE_DPAD_DOWN) dispatchTvKey("DOWN");
                else if (code == KeyEvent.KEYCODE_DPAD_LEFT) dispatchTvKey("LEFT");
                else dispatchTvKey("RIGHT");
                return true;
            }

            if (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || code == KeyEvent.KEYCODE_MEDIA_PLAY || code == KeyEvent.KEYCODE_MEDIA_PAUSE) {
                dispatchTvKey("PLAY_PAUSE");
                return true;
            } else if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_BUTTON_A) {
                dispatchTvKey("ENTER");
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void requestWebViewTextInput() {
        mKeyboardOpen = true;
        if (mWebAppInterface != null) mWebAppInterface.mIsInputActive = true;
        if (mWebView == null) return;
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                try {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showSoftInput(mWebView, InputMethodManager.SHOW_IMPLICIT);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Unable to show text input keyboard", e);
                }
            }
        });
    }

    public void postToWebView(final String js) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (mWebView != null) mWebView.evaluateJavascript(js, null);
            }
        });
    }

    public void dispatchRemoteAction(final String json) {
        PlayerActivity activePlayer = PlayerActivity.getActiveInstance();
        if (activePlayer != null) {
            activePlayer.handleRemoteAction(json);
            try {
                org.json.JSONObject action = new org.json.JSONObject(json);
                String type = action.optString("type", action.optString("action"));
                // Native-player commands must not also reach the hidden WebView.
                // Forwarding toggleFullscreen after finish() could immediately
                // reopen the same preview/player from stale WebView state.
                if ("playNextEpisode".equals(type) || "playPrevEpisode".equals(type)
                        || "togglePlay".equals(type) || "playPause".equals(type)
                        || "toggleMute".equals(type) || "setVolume".equals(type)
                        || "changeVolume".equals(type) || "seek".equals(type)
                        || "seekPercent".equals(type) || "seekPercentage".equals(type)
                        || "toggleFullscreen".equals(type)) {
                    return;
                }
            } catch (Exception ignored) {}
        }
        postToWebView("window.handleRemoteAction && window.handleRemoteAction(" + json + ");");
    }

    public void queuePlaylistImport(final String json) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (!mPageLoaded || mWebView == null) {
                    mPendingPlaylistImport = json;
                    return;
                }
                mWebView.evaluateJavascript("window.importPlaylistFromPhone && window.importPlaylistFromPhone(" + json + ");", null);
            }
        });
    }

    private String getDeviceIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            // Pass 1: Prefer standard 192.168.* LAN addresses
            for (NetworkInterface intf : interfaces) {
                if (intf.isLoopback() || !intf.isUp()) continue;
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        String sAddr = addr.getHostAddress();
                        if (sAddr != null && sAddr.startsWith("192.168.")) {
                            return sAddr;
                        }
                    }
                }
            }

            // Pass 2: Look for 10.* or 172.* LAN addresses
            for (NetworkInterface intf : interfaces) {
                if (intf.isLoopback() || !intf.isUp()) continue;
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        String sAddr = addr.getHostAddress();
                        if (sAddr != null && (sAddr.startsWith("10.") || sAddr.startsWith("172."))) {
                            return sAddr;
                        }
                    }
                }
            }

            // Pass 3: Any non-loopback IPv4
            for (NetworkInterface intf : interfaces) {
                if (intf.isLoopback() || !intf.isUp()) continue;
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        String sAddr = addr.getHostAddress();
                        if (sAddr != null && !sAddr.startsWith("127.")) return sAddr;
                    }
                }
            }
        } catch (Exception ignored) {}

        // Pass 4: WifiManager
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                WifiInfo info = wm.getConnectionInfo();
                int ip = info.getIpAddress();
                if (ip != 0) {
                    return String.format(Locale.getDefault(), "%d.%d.%d.%d",
                            (ip & 0xff), (ip >> 8 & 0xff), (ip >> 16 & 0xff), (ip >> 24 & 0xff));
                }
            }
        } catch (Exception ignored) {}

        return "127.0.0.1";
    }

    private void applyPreviewAspectRatio(final int videoW, final int videoH) {
        if (videoW <= 0 || videoH <= 0 || mPreviewContainer == null || mPreviewSurface == null) return;
        mLastVideoWidth = videoW;
        mLastVideoHeight = videoH;

        if (!mIsPreviewFullscreen) {
            // Dock mode: video fills the preview dock box cleanly edge-to-edge without double-boxing or black padding
            mPreviewContainer.post(new Runnable() {
                @Override
                public void run() {
                    mPreviewContainer.setBackgroundColor(Color.TRANSPARENT);
                    mPreviewSurface.setLayoutParams(new FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            Gravity.CENTER));
                }
            });
            return;
        }

        mPreviewContainer.setBackgroundColor(Color.BLACK);
        mPreviewContainer.post(new Runnable() {
            @Override
            public void run() {
                int containerW = mPreviewContainer.getWidth();
                int containerH = mPreviewContainer.getHeight();
                if (containerW <= 0 || containerH <= 0) return;

                float containerAspect = (float) containerW / (float) containerH;
                float videoAspect = (float) videoW / (float) videoH;

                int finalW = containerW;
                int finalH = containerH;

                if (videoAspect > containerAspect) {
                    finalH = Math.max(1, Math.round((float) containerW / videoAspect));
                } else {
                    finalW = Math.max(1, Math.round((float) containerH * videoAspect));
                }

                FrameLayout.LayoutParams surfaceParams = new FrameLayout.LayoutParams(finalW, finalH, android.view.Gravity.CENTER);
                mPreviewSurface.setLayoutParams(surfaceParams);
            }
        });
    }

    private void queuePreviewBoundsUpdate(final float left, final float top, final float width,
                                           final float height, final float winW, final float winH) {
        synchronized (mPreviewBoundsLock) {
            mPendingPreviewLeft = left;
            mPendingPreviewTop = top;
            mPendingPreviewWidth = width;
            mPendingPreviewHeight = height;
            mPendingPreviewWindowWidth = winW;
            mPendingPreviewWindowHeight = winH;
            if (mPreviewBoundsApplyPosted) return;
            mPreviewBoundsApplyPosted = true;
        }

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                float leftNow;
                float topNow;
                float widthNow;
                float heightNow;
                float winWNow;
                float winHNow;
                synchronized (mPreviewBoundsLock) {
                    leftNow = mPendingPreviewLeft;
                    topNow = mPendingPreviewTop;
                    widthNow = mPendingPreviewWidth;
                    heightNow = mPendingPreviewHeight;
                    winWNow = mPendingPreviewWindowWidth;
                    winHNow = mPendingPreviewWindowHeight;
                    mPreviewBoundsApplyPosted = false;
                }
                applyPreviewBoundsNow(leftNow, topNow, widthNow, heightNow, winWNow, winHNow);
            }
        });
    }

    private void applyPreviewBoundsNow(float left, float top, float width, float height,
                                       float winW, float winH) {
        try {
            if (mIsPreviewFullscreen || mPreviewContainer == null
                    || mPreviewContainer.getVisibility() != View.VISIBLE) return;

            int viewW = (mWebView != null && mWebView.getWidth() > 0)
                    ? mWebView.getWidth() : getResources().getDisplayMetrics().widthPixels;
            int viewH = (mWebView != null && mWebView.getHeight() > 0)
                    ? mWebView.getHeight() : getResources().getDisplayMetrics().heightPixels;
            float scaleX = (winW > 0) ? ((float) viewW / winW) : getResources().getDisplayMetrics().density;
            float scaleY = (winH > 0) ? ((float) viewH / winH) : getResources().getDisplayMetrics().density;

            int l = Math.round(left * scaleX);
            int t = Math.round(top * scaleY);
            int w = Math.round(width * scaleX);
            int h = Math.round(height * scaleY);
            if (w <= 0 || h <= 0) return;

            if (mPreviewBoxParams == null
                    || mPreviewBoxParams.width != w || mPreviewBoxParams.height != h
                    || mPreviewBoxParams.leftMargin != l || mPreviewBoxParams.topMargin != t) {
                mPreviewBoxParams = new FrameLayout.LayoutParams(w, h);
                mPreviewBoxParams.leftMargin = l;
                mPreviewBoxParams.topMargin = t;
                mPreviewContainer.setLayoutParams(mPreviewBoxParams);
            }
        } catch (Exception ignored) {}
    }

    public class WebAppInterface {
        public volatile boolean mIsInputActive = false;

        @JavascriptInterface
        public void setInputActive(final boolean active) {
            mIsInputActive = active;
        }

        @JavascriptInterface
        public void requestTextInput() {
            requestWebViewTextInput();
        }

        @JavascriptInterface
        public void hideTextInput() {
            mKeyboardOpen = false;
            mIsInputActive = false;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                        if (imm != null && mWebView != null) {
                            imm.hideSoftInputFromWindow(mWebView.getWindowToken(), 0);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Unable to hide text input keyboard", e);
                    }
                    if (mWebView != null) {
                        mWebView.requestFocus();
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveLanguage(final String lang) {
            try {
                getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE)
                        .edit()
                        .putString("app_lang", (lang != null && !lang.isEmpty()) ? lang : "en")
                        .apply();
                Log.i(TAG, "Persisted app_lang in SharedPreferences: " + lang);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String getLanguage() {
            try {
                return getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE)
                        .getString("app_lang", "en");
            } catch (Exception e) {
                return "en";
            }
        }

        private long mLastBackPressTime = 0;

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    long now = SystemClock.uptimeMillis();
                    if (now - mLastBackPressTime < 2500) {
                        finish();
                    } else {
                        mLastBackPressTime = now;
                        android.widget.Toast.makeText(MainActivity.this, "Press BACK again to exit", android.widget.Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void logJs(String msg) {
            Log.i("TvAppJs", msg != null ? msg : "null");
        }

        @JavascriptInterface
        public void updateRemoteState(String stateJson) {
            if (mServer != null) {
                mServer.updateState(stateJson);
            }
        }

        /**
         * Launch native PlayerActivity for hardware HEVC/4K video playback.
         */
        @JavascriptInterface
        public void playNativeStream(final String streamUrl, final String title, final double startPositionSec) {
            Log.d(TAG, "playNativeStream: " + streamUrl + " title=" + title + " startPos=" + startPositionSec);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                        intent.putExtra("url", streamUrl);
                        intent.putExtra("title", title != null ? title : "Live Stream");
                        if (startPositionSec > 0) {
                            intent.putExtra("start_position_sec", startPositionSec);
                            intent.putExtra("start_position_ms", (long) (startPositionSec * 1000));
                        }
                        MainActivity.this.startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch PlayerActivity: " + e.getMessage());
                    }
                }
            });
        }

        @JavascriptInterface
        public void playNativeStream(final String streamUrl, final String title) {
            playNativeStream(streamUrl, title, 0.0);
        }

        /**
         * Overloaded playNativeStream(url) for JS backward compatibility.
         */
        @JavascriptInterface
        public void playNativeStream(final String streamUrl) {
            playNativeStream(streamUrl, "Live Stream", 0.0);
        }

        @JavascriptInterface
        public void playNativeMedia(final String streamUrl, final String title, final String itemId,
                                    final String type, final String seriesId, final String season, final String episodeNumber, final double startPositionSec) {
            Log.d(TAG, "playNativeMedia: " + streamUrl + " title=" + title + " startPos=" + startPositionSec);
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                        intent.putExtra("url", streamUrl);
                        intent.putExtra("title", title != null ? title : "Media");
                        intent.putExtra("item_id", itemId != null ? itemId : "");
                        intent.putExtra("content_type", type != null ? type : "movie");
                        intent.putExtra("series_id", seriesId != null ? seriesId : "");
                        intent.putExtra("season", season != null ? season : "");
                        intent.putExtra("episode_number", episodeNumber != null ? episodeNumber : "");
                        if (startPositionSec > 0) {
                            intent.putExtra("start_position_sec", startPositionSec);
                            intent.putExtra("start_position_ms", (long) (startPositionSec * 1000));
                        }
                        MainActivity.this.startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch native media player: " + e.getMessage(), e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void playNativeMedia(final String streamUrl, final String title, final String itemId,
                                    final String type, final String seriesId, final String season, final String episodeNumber) {
            playNativeMedia(streamUrl, title, itemId, type, seriesId, season, episodeNumber, 0.0);
        }

        @JavascriptInterface
        public void playNativeEpisode(final String streamUrl, final String title,
                                      final String episodesJson, final int episodeIndex, final double startPositionSec) {
            Log.d(TAG, "playNativeEpisode: " + streamUrl + " title=" + title + " startPos=" + startPositionSec);
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                        intent.putExtra("url", streamUrl);
                        intent.putExtra("title", title != null ? title : "Series");
                        intent.putExtra("content_type", "series");
                        intent.putExtra("episode_list", episodesJson != null ? episodesJson : "[]");
                        intent.putExtra("episode_index", episodeIndex);
                        if (startPositionSec > 0) {
                            intent.putExtra("start_position_sec", startPositionSec);
                            intent.putExtra("start_position_ms", (long) (startPositionSec * 1000));
                        }
                        MainActivity.this.startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch native episode player: " + e.getMessage(), e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void playNativeEpisode(final String streamUrl, final String title,
                                      final String episodesJson, final int episodeIndex) {
            playNativeEpisode(streamUrl, title, episodesJson, episodeIndex, 0.0);
        }

        /**
         * Stop native player if needed.
         */
        @JavascriptInterface
        public void stopNativeStream() {
            // Handled automatically by PlayerActivity lifecycle
        }

        /**
         * Play stream in embedded hardware-accelerated preview viewport via ExoPlayer.
         */
        @JavascriptInterface
        public void playNativePreview(final String streamUrl, final String itemId, final long seekMs, final float left, final float top, final float width, final float height, final float winW, final float winH) {
            MainActivity.this.mCurrentPreviewItemId = itemId != null ? itemId : "";
            MainActivity.this.mCurrentPreviewStartSeekMs = Math.max(0, seekMs);
            Log.d(TAG, "playNativePreview: " + streamUrl + " itemId=" + mCurrentPreviewItemId + " seekMs=" + mCurrentPreviewStartSeekMs + " rect=[" + left + "," + top + "," + width + "x" + height + "]");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (streamUrl == null || streamUrl.trim().isEmpty()) {
                            stopNativePreview();
                            return;
                        }

                        int viewW = (mWebView != null && mWebView.getWidth() > 0) ? mWebView.getWidth() : getResources().getDisplayMetrics().widthPixels;
                        int viewH = (mWebView != null && mWebView.getHeight() > 0) ? mWebView.getHeight() : getResources().getDisplayMetrics().heightPixels;

                        float scaleX = (winW > 0) ? ((float) viewW / winW) : getResources().getDisplayMetrics().density;
                        float scaleY = (winH > 0) ? ((float) viewH / winH) : getResources().getDisplayMetrics().density;

                        int l = Math.round(left * scaleX);
                        int t = Math.round(top * scaleY);
                        int w = Math.round(width * scaleX);
                        int h = Math.round(height * scaleY);

                        mPreviewBoxParams = new FrameLayout.LayoutParams(w, h);
                        mPreviewBoxParams.leftMargin = l;
                        mPreviewBoxParams.topMargin = t;

                        mIsPreviewFullscreen = false;
                        mPreviewStreamUrl = streamUrl.trim();
                        mPreviewFillMode = false;
                        mPreviewContainer.setLayoutParams(mPreviewBoxParams);
                        mPreviewContainer.setVisibility(View.VISIBLE);

                        if (mPreviewPlayer == null) {
                            DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                                    .setConnectTimeoutMs(4000)
                                    .setReadTimeoutMs(10000)
                                    .setAllowCrossProtocolRedirects(true)
                                    .setKeepPostFor302Redirects(true)
                                    .setUserAgent("Mozilla/5.0 (Linux; Android TV; Nidalplayer/4.0.0; ExoPlayer/2.19.1)");

                            DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                                    .setConstantBitrateSeekingEnabled(true)
                                    .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS)
                                    .setTsExtractorMode(TsExtractor.MODE_SINGLE_PMT)
                                    .setMp4ExtractorFlags(Mp4Extractor.FLAG_WORKAROUND_IGNORE_EDIT_LISTS)
                                    .setMatroskaExtractorFlags(MatroskaExtractor.FLAG_DISABLE_SEEK_FOR_CUES);

                            DefaultMediaSourceFactory sourceFactory = new DefaultMediaSourceFactory(httpFactory, extractorsFactory);

                            DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                                    .setBufferDurationsMs(
                                            8000,  // minBufferMs (8s)
                                            20000, // maxBufferMs (20s - frees up memory on low-RAM TV boxes)
                                            200,   // bufferForPlaybackMs (ultra-fast start 200ms)
                                            500    // bufferForPlaybackAfterRebufferMs
                                    )
                                    .setBackBuffer(5000, false)
                                    .setPrioritizeTimeOverSizeThresholds(true)
                                    .build();

                            mPreviewPlayer = new ExoPlayer.Builder(MainActivity.this)
                                    .setMediaSourceFactory(sourceFactory)
                                    .setLoadControl(loadControl)
                                    .setSeekParameters(SeekParameters.CLOSEST_SYNC)
                                    .setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
                                    .build();
                            mPreviewPlayer.setVideoTextureView(mPreviewSurface);
                            mPreviewPlayer.setVolume(1.0f);

                            mPreviewPlayer.addListener(new Player.Listener() {
                                @Override
                                public void onVideoSizeChanged(VideoSize videoSize) {
                                    if (videoSize.width > 0 && videoSize.height > 0) {
                                        applyPreviewAspectRatio(videoSize.width, videoSize.height);
                                    }
                                }
                            });
                        }

                        MediaItem mediaItem = new MediaItem.Builder()
                                .setUri(Uri.parse(streamUrl.trim()))
                                .build();

                        long startSeek = MainActivity.this.mCurrentPreviewStartSeekMs;
                        if (startSeek > 0) {
                            Log.i(TAG, "playNativePreview: Instant atomic seekTo " + startSeek + "ms for " + streamUrl);
                            mPreviewPlayer.setMediaItem(mediaItem, startSeek);
                        } else {
                            mPreviewPlayer.setMediaItem(mediaItem);
                        }
                        mPreviewPlayer.prepare();
                        mPreviewPlayer.setPlayWhenReady(true);
                    } catch (Exception e) {
                        Log.e(TAG, "Native preview playback failed: " + e.getMessage(), e);
                    }
                }
            });
        }

        @JavascriptInterface
        public void playNativePreview(final String streamUrl, final float left, final float top, final float width, final float height, final float winW, final float winH) {
            playNativePreview(streamUrl, "", 0L, left, top, width, height, winW, winH);
        }

        @JavascriptInterface
        public void playNativePreview(final String streamUrl, final float left, final float top, final float width, final float height) {
            playNativePreview(streamUrl, "", 0L, left, top, width, height, 0, 0);
        }

        @JavascriptInterface
        public void updatePreviewBounds(final float left, final float top, final float width, final float height, final float winW, final float winH) {
            queuePreviewBoundsUpdate(left, top, width, height, winW, winH);
        }

        @JavascriptInterface
        public void setPreviewInfo(final String title, final String category) {
            mCurrentPreviewTitle = (title != null && !title.isEmpty()) ? title : "Live TV Channel";
            mCurrentPreviewCategory = (category != null && !category.isEmpty()) ? category : "All Channels";
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (mPreviewTitleText != null) mPreviewTitleText.setText(mCurrentPreviewTitle);
                    if (mPreviewStatusText != null) {
                        mPreviewStatusText.setText(getPreviewLocalizedStatus(mCurrentPreviewCategory));
                    }
                }
            });
        }

        @JavascriptInterface
        public void expandNativePreviewToFullscreen(final String title, final String category) {
            setPreviewInfo(title, category);
            expandNativePreviewToFullscreen();
        }

        /**
          * Expand already playing preview to Fullscreen seamlessly in 0ms without stream reload.
          */
        @JavascriptInterface
        public void expandNativePreviewToFullscreen() {
            Log.d(TAG, "expandNativePreviewToFullscreen: Expanding preview without reload");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        mIsPreviewFullscreen = true;
                        FrameLayout.LayoutParams fsParams = new FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT
                        );
                        fsParams.leftMargin = 0;
                        fsParams.topMargin = 0;
                        mPreviewContainer.setLayoutParams(fsParams);
                        mPreviewContainer.setVisibility(View.VISIBLE);
                        mPreviewContainer.setClipToOutline(false);
                        mPreviewContainer.invalidateOutline();
                        applyPreviewAspectRatio(mLastVideoWidth, mLastVideoHeight);

                        showPreviewOverlayForInteraction();
                        if (mPreviewSeekBar != null) {
                            mPreviewSeekBar.postDelayed(() -> {
                                boolean focused = mPreviewSeekBar.requestFocus();
                                Log.d(TAG, "Preview initial seekbar focus=" + focused + " current=" + getCurrentFocus());
                            }, 40L);
                        }
                        if (mPreviewUiHandler != null && mPreviewUiRunnable != null) {
                            mPreviewUiHandler.removeCallbacks(mPreviewUiRunnable);
                            mPreviewUiHandler.post(mPreviewUiRunnable);
                        }
                        schedulePreviewOverlayHide();
                    } catch (Exception e) {
                        Log.e(TAG, "Expand to fullscreen error: " + e.getMessage());
                    }
                }
            });
        }

        /**
         * Shrink fullscreen preview back to preview box seamlessly without stream reload.
         */
        @JavascriptInterface
        public void shrinkNativePreview() {
            Log.d(TAG, "shrinkNativePreview: Shrinking fullscreen back to preview dock");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        exitNativePreviewFullscreenNow();
                    } catch (Exception e) {
                        Log.e(TAG, "Shrink preview error: " + e.getMessage());
                    }
                }
            });
        }

        /**
         * Stop embedded hardware-accelerated preview playback.
         */
        @JavascriptInterface
        public void stopNativePreview() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        mIsPreviewFullscreen = false;
                        if (mPreviewUiHandler != null && mPreviewUiRunnable != null) {
                            mPreviewUiHandler.removeCallbacks(mPreviewUiRunnable);
                        }
                        if (mPreviewOverlay != null) mPreviewOverlay.setVisibility(View.GONE);
                        if (mPreviewPlayer != null) {
                            mPreviewPlayer.stop();
                            mPreviewPlayer.clearMediaItems();
                        }
                        if (mPreviewContainer != null) {
                            mPreviewContainer.setVisibility(View.GONE);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Stop native preview error: " + e.getMessage());
                    }
                }
            });
        }

        /**
         * Toggle play/pause on embedded hardware preview.
         */
        @JavascriptInterface
        public void toggleNativePreviewPlayPause() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (mPreviewPlayer != null) {
                            if (mPreviewPlayer.isPlaying()) {
                                mPreviewPlayer.pause();
                            } else {
                                mPreviewPlayer.play();
                            }
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        /**
         * Seek relative (+/- seconds) on embedded hardware preview.
         */
        @JavascriptInterface
        public void seekNativePreviewRelative(final long deltaMs) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (mPreviewPlayer != null) {
                            long cur = mPreviewPlayer.getCurrentPosition();
                            long dur = mPreviewPlayer.getDuration();
                            long target = Math.max(0, cur + deltaMs);
                            if (dur > 0 && target > dur) target = dur;
                            mPreviewPlayer.seekTo(target);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        /**
         * Seek to exact position (ms) on embedded hardware preview.
         */
        @JavascriptInterface
        public void seekNativePreviewTo(final long targetMs) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (mPreviewPlayer != null) {
                            mPreviewPlayer.seekTo(Math.max(0, targetMs));
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void setVolume(final double vol) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (mPreviewPlayer != null) {
                            mPreviewPlayer.setVolume((float) Math.max(0.0, Math.min(1.0, vol)));
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void toggleMute() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (mPreviewPlayer != null) {
                            float curVol = mPreviewPlayer.getVolume();
                            mPreviewPlayer.setVolume(curVol > 0.05f ? 0.0f : 1.0f);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void cycleAudioTrackFromWeb() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    cycleAudioTrack();
                }
            });
        }

        @JavascriptInterface
        public void cycleSubtitleTrackFromWeb() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    cycleSubtitleTrack();
                }
            });
        }

        /**
         * Open stream in third-party external player (VLC, MX Player, etc.)
         */
        @JavascriptInterface
        public void openExternalPlayer(final String streamUrl) {
            Log.d(TAG, "openExternalPlayer called: " + streamUrl);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(Uri.parse(streamUrl), "video/*");
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        MainActivity.this.startActivity(Intent.createChooser(intent, "Play Stream With..."));
                    } catch (Exception e) {
                        Log.e(TAG, "External player launch failed: " + e.getMessage());
                    }
                }
            });
        }

        /**
         * Check if native player supports a given MIME type.
         */
        @JavascriptInterface
        public boolean canPlayType(String mimeType) {
            try {
                android.media.MediaCodecList codecs = new android.media.MediaCodecList(android.media.MediaCodecList.ALL_CODECS);
                for (android.media.MediaCodecInfo info : codecs.getCodecInfos()) {
                    if (info.isEncoder()) continue;
                    for (String type : info.getSupportedTypes()) {
                        if (type.equalsIgnoreCase(mimeType)) return true;
                    }
                }
            } catch (Exception ignored) {}
            return false;
        }
    }

    public static void notifyNativePlayerProgress(final String json) {
        if (sInstance != null && json != null) {
            final String quoted = org.json.JSONObject.quote(json);
            sInstance.postToWebView("window.onNativePlayerProgress && window.onNativePlayerProgress(JSON.parse(" + quoted + "));" );
            try {
                org.json.JSONObject obj = new org.json.JSONObject(json);
                String title = obj.optString("title", "");
                String type = obj.optString("type", "movie");
                double pos = obj.optDouble("position", 0.0);
                double dur = obj.optDouble("duration", 0.0);
                boolean paused = obj.optBoolean("paused", false);
                if (sInstance.mServer != null) {
                    sInstance.mServer.updatePlayback(title, type, pos, dur, paused);
                }
            } catch (Exception ignored) {}
        }
    }

    private static void notifyNativePreviewProgress(long positionMs, long durationMs, boolean paused) {
        if (sInstance == null) return;
        try {
            org.json.JSONObject obj = new org.json.JSONObject();
            obj.put("itemId", sInstance.mCurrentPreviewItemId != null ? sInstance.mCurrentPreviewItemId : "");
            obj.put("position", positionMs / 1000.0);
            obj.put("duration", durationMs / 1000.0);
            obj.put("paused", paused);
            notifyNativePlayerProgress(obj.toString());
        } catch (Exception ignored) {}
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.post(new Runnable() {
                @Override
                public void run() {
                    mWebView.evaluateJavascript("window.onWindowResumed && window.onWindowResumed();", null);
                }
            });
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mPreviewPlayer != null) {
            mPreviewPlayer.pause();
        }
        if (mPreviewUiHandler != null && mPreviewUiRunnable != null) {
            mPreviewUiHandler.removeCallbacks(mPreviewUiRunnable);
        }
    }

    @Override
    protected void onDestroy() {
        if (sInstance == this) sInstance = null;
        super.onDestroy();
        if (mPreviewUiHandler != null && mPreviewUiRunnable != null) {
            mPreviewUiHandler.removeCallbacks(mPreviewUiRunnable);
        }
        if (mPreviewPlayer != null) {
            mPreviewPlayer.release();
            mPreviewPlayer = null;
        }
        if (mServer != null) mServer.stop();
        if (mWebView != null) mWebView.destroy();
    }
}
