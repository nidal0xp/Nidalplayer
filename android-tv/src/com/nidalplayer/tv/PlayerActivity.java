package com.nidalplayer.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.SeekParameters;
import com.google.android.exoplayer2.extractor.DefaultExtractorsFactory;
import com.google.android.exoplayer2.extractor.ts.DefaultTsPayloadReaderFactory;
import com.google.android.exoplayer2.extractor.ts.TsExtractor;
import com.google.android.exoplayer2.extractor.mp4.Mp4Extractor;
import com.google.android.exoplayer2.extractor.mkv.MatroskaExtractor;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.trackselection.AdaptiveTrackSelection;
import com.google.android.exoplayer2.trackselection.DefaultTrackSelector;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.video.VideoSize;

import com.google.android.exoplayer2.Tracks;
import com.google.android.exoplayer2.trackselection.TrackSelectionOverride;
import com.google.android.exoplayer2.trackselection.TrackSelectionParameters;
import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Premium Android TV Native PlayerActivity powered by Google ExoPlayer 2.19.1.
 * Features full TV OSD with Interactive Buttons, Seekbar, Aspect Ratio, D-Pad Remote Navigation.
 */
public class PlayerActivity extends Activity {

    private static final String TAG = "NidalPlayer_Exo";
    private static PlayerActivity sActiveInstance;

    public static PlayerActivity getActiveInstance() {
        return sActiveInstance;
    }

    public void handleRemoteAction(final String json) {
        try {
            JSONObject act = new JSONObject(json);
            String type = act.optString("type", act.optString("action"));

            if ("playNextEpisode".equals(type)) {
                runOnUiThread(new Runnable() { @Override public void run() { playAdjacentEpisode(1); } });
            } else if ("playPrevEpisode".equals(type)) {
                runOnUiThread(new Runnable() { @Override public void run() { playAdjacentEpisode(-1); } });
            } else if ("togglePlay".equals(type) || "playPause".equals(type)) {
                runOnUiThread(new Runnable() { @Override public void run() { togglePlayPause(); } });
            } else if ("toggleMute".equals(type)) {
                runOnUiThread(new Runnable() { @Override public void run() { toggleMute(); } });
            } else if ("setVolume".equals(type)) {
                final float value = (float) Math.max(0.0, Math.min(1.0, act.optDouble("value", 1.0)));
                runOnUiThread(new Runnable() { @Override public void run() { setPlayerVolume(value); } });
            } else if ("toggleFullscreen".equals(type)) {
                runOnUiThread(new Runnable() { @Override public void run() { closePlayerAndReturn(); } });
            } else if ("seek".equals(type)) {
                final long relative = act.optLong("relative", 0);
                if (relative != 0) {
                    runOnUiThread(new Runnable() { @Override public void run() { seekRelative(relative * 1000); } });
                } else if (act.has("time") || act.has("position")) {
                    double timeSec = act.optDouble("time", act.optDouble("position", 0));
                    final long targetMs = (long) (timeSec * 1000);
                    runOnUiThread(new Runnable() { @Override public void run() { seekToPosition(targetMs); } });
                }
            } else if ("seekPercent".equals(type) || "seekPercentage".equals(type)) {
                final double percent = act.optDouble("percentage", act.optDouble("percent", 0));
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (mExoPlayer != null && mExoPlayer.getDuration() > 0) {
                            long target = (long) (mExoPlayer.getDuration() * (percent / 100.0));
                            seekToPosition(target);
                        }
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Remote action failed: " + e.getMessage());
        }
    }

    private ExoPlayer mExoPlayer;
    private SurfaceView mSurfaceView;
    private ProgressBar mLoadingBar;

    // OSD Containers
    private FrameLayout mOsdRoot;
    private LinearLayout mTopBar;
    private LinearLayout mBottomBar;
    private LinearLayout mButtonBar;

    // Top Bar UI
    private TextView mTitleText;
    private TextView mStatusText;
    private TextView mCodecBadge;

    // Bottom Bar UI & Seekbar
    private LinearLayout mSeekbarLayout;
    private SeekBar mSeekBar;
    private TextView mTimeCurrent;
    private TextView mTimeDuration;
    private TextView mLiveBadge;

    // Interactive Buttons
    private TextView mBtnPrev;
    private TextView mBtnRewind;
    private TextView mBtnPlayPause;
    private TextView mBtnForward;
    private TextView mBtnNext;
    private TextView mBtnAspect;
    private TextView mBtnAudio;
    private TextView mBtnSub;
    private TextView mBtnVlc;
    private TextView mBtnExit;
    private int mSelectedAudioIndex = 0;
    private int mSelectedSubIndex = -1;

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    // State & Timers
    private Handler mHandler;
    private Runnable mHideOsdRunnable;
    private Runnable mUpdateProgressRunnable;
    private Runnable mPendingSeekRunnable;
    private String mStreamUrl;
    private String mTitle;
    private String mItemId = "";
    private String mContentType = "movie";
    private String mSeriesId = "";
    private String mSeriesName = "";
    private int mEpisodeIndex = 0;
    private final ArrayList<NativeEpisode> mEpisodes = new ArrayList<>();
    private boolean mIsLive = false;
    private int mAspectMode = 0; // 0: Fit (16:9), 1: Fill (Stretch), 2: Zoom (Crop)
    private boolean mIsUserSeeking = false;
    private long mStartPositionMs = 0;
    private boolean mIsClosing = false;
    private float mLastVolume = 1.0f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sActiveInstance = this;

        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                Log.e(TAG, "UNCAUGHT_EXCEPTION on thread [" + t.getName() + "]: " + e.getMessage(), e);
            }
        });

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        mHandler = new Handler(Looper.getMainLooper());
        mHideOsdRunnable = new Runnable() {
            @Override
            public void run() {
                hideOsd();
            }
        };

        mUpdateProgressRunnable = new Runnable() {
            @Override
            public void run() {
                updateProgress();
                if (mExoPlayer != null && mExoPlayer.isPlaying()) {
                    mHandler.postDelayed(mUpdateProgressRunnable, 500);
                }
            }
        };

        mStreamUrl = getIntent().getStringExtra("url");
        mTitle = getIntent().getStringExtra("title");
        if (mTitle == null || mTitle.isEmpty()) mTitle = "Live Channel";
        mItemId = getIntent().getStringExtra("item_id");
        if (mItemId == null) mItemId = "";
        mContentType = getIntent().getStringExtra("content_type");
        if (mContentType == null || mContentType.isEmpty()) mContentType = "movie";
        mSeriesId = getIntent().getStringExtra("series_id");
        if (mSeriesId == null) mSeriesId = "";
        mEpisodeIndex = Math.max(0, getIntent().getIntExtra("episode_index", 0));
        parseEpisodeList(getIntent().getStringExtra("episode_list"));

        mIsLive = "live".equalsIgnoreCase(mContentType)
                || (mStreamUrl != null && mStreamUrl.contains("/live/"));

        mStartPositionMs = getIntent().getLongExtra("start_position_ms", 0);
        if (mStartPositionMs <= 0) {
            double startSec = getIntent().getDoubleExtra("start_position_sec", 0);
            if (startSec > 0) mStartPositionMs = (long) (startSec * 1000);
        }
        if (mIsLive) mStartPositionMs = 0;

        Log.i(TAG, "PlayerActivity launch: url=" + mStreamUrl + " contentType=" + mContentType + " startPositionMs=" + mStartPositionMs);

        buildUi();

        if (mStreamUrl != null && !mStreamUrl.isEmpty()) {
            initExoPlayer(mStreamUrl);
        } else {
            Toast.makeText(this, "Invalid stream URL", Toast.LENGTH_SHORT).show();
            finish();
        }

        showOsd(8000);
        if (mBtnPlayPause != null) {
            mBtnPlayPause.post(new Runnable() {
                @Override public void run() { mBtnPlayPause.requestFocus(); }
            });
        }
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        // 1. SurfaceView (Video render surface - non-focusable so D-Pad targets buttons)
        mSurfaceView = new SurfaceView(this);
        mSurfaceView.setFocusable(false);
        mSurfaceView.setFocusableInTouchMode(false);
        // Ensure SurfaceView is behind the window content
        mSurfaceView.setZOrderMediaOverlay(false);
        FrameLayout.LayoutParams svParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.CENTER);
        root.addView(mSurfaceView, svParams);

        // 2. Loading Spinner
        mLoadingBar = new ProgressBar(this);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER);
        root.addView(mLoadingBar, pbParams);

        // 3. Full OSD Root Overlay
        mOsdRoot = new FrameLayout(this);
        mOsdRoot.setBackgroundColor(Color.TRANSPARENT);
        mOsdRoot.setFocusable(false);
        mOsdRoot.setFocusableInTouchMode(false);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            mOsdRoot.setZ(1000f);
        }

        // --- TOP BAR (with TV Overscan Safe Margins) ---
        mTopBar = new LinearLayout(this);
        mTopBar.setOrientation(LinearLayout.HORIZONTAL);
        mTopBar.setGravity(Gravity.CENTER_VERTICAL);
        int topPadH = dpToPx(20);
        int topPadV = dpToPx(12);
        mTopBar.setPadding(topPadH, topPadV, topPadH, topPadV);
        GradientDrawable topBg = new GradientDrawable();
        topBg.setColor(Color.parseColor("#E6080A0E"));
        topBg.setCornerRadius(dpToPx(12));
        mTopBar.setBackground(topBg);

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP);
        topParams.setMargins(dpToPx(24), dpToPx(16), dpToPx(24), 0);

        LinearLayout titleBox = new LinearLayout(this);
        titleBox.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tbp = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        titleBox.setLayoutParams(tbp);

        mTitleText = new TextView(this);
        mTitleText.setTextColor(Color.WHITE);
        mTitleText.setTextSize(20f);
        mTitleText.setTypeface(null, android.graphics.Typeface.BOLD);
        mTitleText.setSingleLine(true);
        mTitleText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        mTitleText.setText(mTitle);
        titleBox.addView(mTitleText);

        mStatusText = new TextView(this);
        mStatusText.setTextColor(Color.parseColor("#FF6B3D"));
        mStatusText.setTextSize(12f);
        mStatusText.setTypeface(null, android.graphics.Typeface.BOLD);
        mStatusText.setSingleLine(true);
        mStatusText.setText(getLocalizedStatus("1920x1080 (1080p FHD)"));
        titleBox.addView(mStatusText);

        mTopBar.addView(titleBox);

        mCodecBadge = new TextView(this);
        mCodecBadge.setText("HW HD");
        mCodecBadge.setTextColor(Color.parseColor("#4ade80"));
        mCodecBadge.setTextSize(11f);
        mCodecBadge.setTypeface(null, android.graphics.Typeface.BOLD);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.parseColor("#15803d33"));
        badgeBg.setCornerRadius(dpToPx(6));
        badgeBg.setStroke(dpToPx(1), Color.parseColor("#4ade8033"));
        mCodecBadge.setBackground(badgeBg);
        int badgePadH = dpToPx(10);
        int badgePadV = dpToPx(4);
        mCodecBadge.setPadding(badgePadH, badgePadV, badgePadH, badgePadV);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        mTopBar.addView(mCodecBadge, badgeParams);

        mOsdRoot.addView(mTopBar, topParams);

        // --- BOTTOM BAR (with TV Overscan Safe Margins) ---
        mBottomBar = new LinearLayout(this);
        mBottomBar.setOrientation(LinearLayout.VERTICAL);
        int botPadH = dpToPx(20);
        int botPadV = dpToPx(16);
        mBottomBar.setPadding(botPadH, botPadV, botPadH, botPadV);
        GradientDrawable botBg = new GradientDrawable();
        botBg.setColor(Color.parseColor("#E6080A0E"));
        botBg.setCornerRadius(dpToPx(12));
        mBottomBar.setBackground(botBg);

        FrameLayout.LayoutParams botParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM);
        botParams.setMargins(dpToPx(24), 0, dpToPx(24), dpToPx(20));

        // Seekbar row (for VOD / movies / series)
        mSeekbarLayout = new LinearLayout(this);
        mSeekbarLayout.setOrientation(LinearLayout.HORIZONTAL);
        mSeekbarLayout.setGravity(Gravity.CENTER_VERTICAL);
        mSeekbarLayout.setPadding(0, 0, 0, dpToPx(14));

        mTimeCurrent = new TextView(this);
        mTimeCurrent.setTextColor(Color.WHITE);
        mTimeCurrent.setTextSize(12f);
        mTimeCurrent.setTypeface(null, android.graphics.Typeface.BOLD);
        mTimeCurrent.setSingleLine(true);
        mTimeCurrent.setGravity(Gravity.CENTER);
        mTimeCurrent.setText("00:00:00");
        mSeekbarLayout.addView(mTimeCurrent, new LinearLayout.LayoutParams(dpToPx(72), LinearLayout.LayoutParams.WRAP_CONTENT));

        mSeekBar = new SeekBar(this);
        mSeekBar.setFocusable(true);
        mSeekBar.setFocusableInTouchMode(true);
        mSeekBar.setMax(1000);
        GradientDrawable thumb = new GradientDrawable();
        thumb.setShape(GradientDrawable.OVAL);
        thumb.setColor(Color.parseColor("#FF5500"));
        thumb.setSize(dpToPx(16), dpToPx(16));
        thumb.setStroke(dpToPx(2), Color.WHITE);
        mSeekBar.setThumb(thumb);
        mSeekBar.setPadding(dpToPx(12), dpToPx(14), dpToPx(12), dpToPx(14));
        mSeekBar.setSplitTrack(false);

        LinearLayout.LayoutParams seekParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        seekParams.setMargins(dpToPx(8), 0, dpToPx(8), 0);
        mSeekBar.setLayoutParams(seekParams);
        mSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && mExoPlayer != null && mExoPlayer.getDuration() > 0) {
                    mIsUserSeeking = true;
                    long target = (long) (mExoPlayer.getDuration() * (progress / 1000.0));
                    mTimeCurrent.setText(formatTime(target));
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                mIsUserSeeking = true;
                showOsd(0);
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                if (mExoPlayer != null && mExoPlayer.getDuration() > 0) {
                    long target = (long) (mExoPlayer.getDuration() * (seekBar.getProgress() / 1000.0));
                    seekToPosition(target);
                } else {
                    mIsUserSeeking = false;
                }
                showOsd(5000);
            }
        });
        mSeekbarLayout.addView(mSeekBar);

        mTimeDuration = new TextView(this);
        mTimeDuration.setTextColor(Color.parseColor("#94A3B8"));
        mTimeDuration.setTextSize(12f);
        mTimeDuration.setTypeface(null, android.graphics.Typeface.BOLD);
        mTimeDuration.setSingleLine(true);
        mTimeDuration.setGravity(Gravity.CENTER);
        mTimeDuration.setText("00:00:00");
        mSeekbarLayout.addView(mTimeDuration, new LinearLayout.LayoutParams(dpToPx(72), LinearLayout.LayoutParams.WRAP_CONTENT));

        mLiveBadge = new TextView(this);
        mLiveBadge.setText("● LIVE BROADCAST");
        mLiveBadge.setTextColor(Color.parseColor("#EF4444"));
        mLiveBadge.setTextSize(12f);
        mLiveBadge.setTypeface(null, android.graphics.Typeface.BOLD);
        mLiveBadge.setVisibility(mIsLive ? View.VISIBLE : View.GONE);
        mSeekbarLayout.addView(mLiveBadge);

        if (mIsLive) {
            mTimeCurrent.setVisibility(View.GONE);
            mSeekBar.setVisibility(View.GONE);
            mTimeDuration.setVisibility(View.GONE);
        }

        mBottomBar.addView(mSeekbarLayout);

        // --- BUTTON ROW ---
        mButtonBar = new LinearLayout(this);
        mButtonBar.setOrientation(LinearLayout.HORIZONTAL);
        mButtonBar.setGravity(Gravity.CENTER_VERTICAL);

        mBtnPrev = createOsdButton(getLocalizedButton("prev_ep"), v -> playAdjacentEpisode(-1));
        mBtnRewind = createOsdButton("⏪ -10s", v -> seekRelative(-10000));
        mBtnPlayPause = createOsdButton(getLocalizedPlayPauseText(true), v -> togglePlayPause());
        mBtnForward = createOsdButton("⏩ +10s", v -> seekRelative(10000));
        mBtnNext = createOsdButton(getLocalizedButton("next_ep"), v -> playAdjacentEpisode(1));
        mBtnAspect = createOsdButton(getLocalizedButton("aspect"), v -> toggleAspectRatio());
        mBtnAudio = createOsdButton(getLocalizedButton("audio"), v -> cycleAudioTrack());
        mBtnSub = createOsdButton(getLocalizedButton("sub"), v -> cycleSubtitleTrack());
        mBtnVlc = createOsdButton("⛶ VLC", v -> openExternalPlayer());
        mBtnExit = createOsdButton(getLocalizedButton("exit"), v -> closePlayerAndReturn());

        mBtnPrev.setVisibility(mEpisodes.size() > 0 ? View.VISIBLE : View.GONE);
        mBtnNext.setVisibility(mEpisodes.size() > 0 ? View.VISIBLE : View.GONE);
        mButtonBar.addView(mBtnPrev);
        mButtonBar.addView(mBtnRewind);
        mButtonBar.addView(mBtnPlayPause);
        mButtonBar.addView(mBtnForward);
        mButtonBar.addView(mBtnNext);
        mButtonBar.addView(mBtnAspect);
        mButtonBar.addView(mBtnAudio);
        mButtonBar.addView(mBtnSub);
        mButtonBar.addView(mBtnVlc);
        mButtonBar.addView(mBtnExit);

        mBottomBar.addView(mButtonBar);
        mOsdRoot.addView(mBottomBar, botParams);

        root.addView(mOsdRoot, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
    }

    private TextView createOsdButton(String label, final View.OnClickListener listener) {
        final TextView btn = new TextView(this);
        btn.setText(label);
        btn.setTextColor(Color.parseColor("#E2E8F0"));
        btn.setTextSize(12f);
        btn.setTypeface(null, android.graphics.Typeface.BOLD);
        btn.setSingleLine(true);
        btn.setMaxLines(1);
        btn.setEllipsize(android.text.TextUtils.TruncateAt.END);
        btn.setIncludeFontPadding(false);
        btn.setGravity(Gravity.CENTER);
        btn.setFocusable(true);
        btn.setFocusableInTouchMode(true);
        btn.setMinWidth(0);
        btn.setMinimumWidth(0);
        int padH = dpToPx(8);
        int padV = dpToPx(10);
        btn.setPadding(padH, padV, padH, padV);

        final GradientDrawable normalBg = new GradientDrawable();
        normalBg.setColor(Color.parseColor("#1E293B"));
        normalBg.setCornerRadius(dpToPx(8));
        normalBg.setStroke(dpToPx(1), Color.parseColor("#334155"));

        final GradientDrawable focusBg = new GradientDrawable();
        focusBg.setColor(Color.parseColor("#FF5500"));
        focusBg.setCornerRadius(dpToPx(8));
        focusBg.setStroke(dpToPx(2), Color.WHITE);

        btn.setBackground(normalBg);

        btn.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                btn.setBackground(hasFocus ? focusBg : normalBg);
                btn.setTextColor(hasFocus ? Color.WHITE : Color.parseColor("#E2E8F0"));
                if (hasFocus) {
                    showOsd(6000);
                }
            }
        });

        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onClick(v);
                showOsd(4000);
            }
        });

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        lp.setMargins(dpToPx(4), 0, dpToPx(4), 0);
        btn.setLayoutParams(lp);
        return btn;
    }

    private TextView createPrimaryButton(String label, final View.OnClickListener listener) {
        return createOsdButton(label, listener);
    }

    private void initExoPlayer(final String url) {
        Log.d(TAG, "initExoPlayer: " + url);
        mLoadingBar.setVisibility(View.VISIBLE);

        try {
            DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent("Mozilla/5.0 (Linux; Android TV; NidalPlayer/4.0.0; ExoPlayer/2.19.1)")
                    .setConnectTimeoutMs(4000)
                    .setReadTimeoutMs(10000)
                    .setKeepPostFor302Redirects(true)
                    .setAllowCrossProtocolRedirects(true);

            DefaultTrackSelector trackSelector = new DefaultTrackSelector(this,
                    new AdaptiveTrackSelection.Factory());

            DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                    .setConstantBitrateSeekingEnabled(true)
                    .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS)
                    .setTsExtractorMode(TsExtractor.MODE_SINGLE_PMT)
                    .setMp4ExtractorFlags(Mp4Extractor.FLAG_WORKAROUND_IGNORE_EDIT_LISTS)
                    .setMatroskaExtractorFlags(MatroskaExtractor.FLAG_DISABLE_SEEK_FOR_CUES);

            DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(httpFactory, extractorsFactory);

            DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                    .setBufferDurationsMs(
                            15000, // minBufferMs
                            50000, // maxBufferMs
                            250,   // bufferForPlaybackMs (instant start 250ms!)
                            600    // bufferForPlaybackAfterRebufferMs
                    )
                    .setPrioritizeTimeOverSizeThresholds(true)
                    .build();

            mExoPlayer = new ExoPlayer.Builder(this)
                    .setMediaSourceFactory(mediaSourceFactory)
                    .setLoadControl(loadControl)
                    .setTrackSelector(trackSelector)
                    .setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
                    .setSeekParameters(SeekParameters.CLOSEST_SYNC)
                    .build();

            mExoPlayer.setVideoSurfaceView(mSurfaceView);

            MediaItem mediaItem = new MediaItem.Builder()
                    .setUri(Uri.parse(url))
                    .build();

            if (mStartPositionMs > 0 && !mIsLive) {
                Log.i(TAG, "ExoPlayer initial atomic seekTo: " + mStartPositionMs + "ms (" + formatTime(mStartPositionMs) + ")");
                mExoPlayer.setMediaItem(mediaItem, mStartPositionMs);
            } else {
                mExoPlayer.setMediaItem(mediaItem);
            }

            mExoPlayer.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        mLoadingBar.setVisibility(View.GONE);
                        long dur = mExoPlayer.getDuration();
                        if (dur > 0 && !mIsLive) {
                            mTimeDuration.setText(formatTime(dur));
                        }
                        if (mStartPositionMs > 0 && !mIsLive) {
                            long resumePos = mStartPositionMs;
                            mStartPositionMs = 0; // consumed
                            Log.i(TAG, "ExoPlayer STATE_READY applying resume seek to: " + resumePos + "ms");
                            mExoPlayer.seekTo(resumePos);
                            if (dur > 0) {
                                int progress = (int) ((resumePos * 1000) / dur);
                                mSeekBar.setProgress(progress);
                                mTimeCurrent.setText(formatTime(resumePos));
                            }
                        }
                        showOsd(4000);
                    } else if (state == Player.STATE_BUFFERING) {
                        mLoadingBar.setVisibility(View.VISIBLE);
                    } else if (state == Player.STATE_ENDED) {
                        if (mEpisodes.size() > 0 && mEpisodeIndex < mEpisodes.size() - 1) {
                            playAdjacentEpisode(1);
                        } else {
                            finish();
                        }
                    }
                }

                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
                    if (isPlaying) {
                        mLoadingBar.setVisibility(View.GONE);
                        mBtnPlayPause.setText(getLocalizedPlayPauseText(true));
                        mHandler.post(mUpdateProgressRunnable);
                    } else {
                        mBtnPlayPause.setText(getLocalizedPlayPauseText(false));
                        mHandler.removeCallbacks(mUpdateProgressRunnable);
                    }
                }

                @Override
                public void onVideoSizeChanged(VideoSize videoSize) {
                    Log.d(TAG, "Video resolution: " + videoSize.width + "x" + videoSize.height);
                    if (videoSize.width > 0 && videoSize.height > 0) {
                        String resLabel = videoSize.width + "x" + videoSize.height;
                        if (videoSize.width >= 3840 || videoSize.height >= 2160) {
                            resLabel += " (4K UHD)";
                        } else if (videoSize.width >= 1920 || videoSize.height >= 1080) {
                            resLabel += " (1080p FHD)";
                        } else if (videoSize.width >= 1280 || videoSize.height >= 720) {
                            resLabel += " (720p HD)";
                        }
                        mStatusText.setText(getLocalizedStatus(resLabel));
                        mCodecBadge.setText("HW " + (videoSize.height >= 2160 ? "4K HEVC" : "HD"));
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Log.e(TAG, "ExoPlayer error: " + error.getMessage() + " (code: " + error.errorCode + ")", error);
                    mLoadingBar.setVisibility(View.GONE);
                    mStatusText.setTextColor(Color.parseColor("#FF3333"));
                    mStatusText.setText("Stream error (code " + error.errorCode + ") - Try VLC button");
                    showOsd(0);
                }
            });

            mExoPlayer.prepare();
            mExoPlayer.setPlayWhenReady(true);
            showOsd(6000);

        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize ExoPlayer: " + e.getMessage(), e);
            mLoadingBar.setVisibility(View.GONE);
            mStatusText.setText("Initialization error: " + e.getMessage());
            showOsd(0);
        }
    }

    private void updateProgress() {
        if (mExoPlayer == null || mIsUserSeeking || mIsLive) return;
        long pos = mExoPlayer.getCurrentPosition();
        long dur = mExoPlayer.getDuration();
        if (dur > 0) {
            int progress = (int) ((pos * 1000) / dur);
            mSeekBar.setProgress(progress);
            mTimeCurrent.setText(formatTime(pos));
            mTimeDuration.setText(formatTime(dur));
            sendProgressCallback(pos, dur);
        }
    }

    private void sendProgressCallback(long positionMs, long durationMs) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("itemId", mItemId);
            obj.put("title", mTitle != null ? mTitle : "");
            obj.put("type", mContentType != null ? mContentType : "movie");
            obj.put("position", positionMs / 1000.0);
            obj.put("duration", durationMs / 1000.0);
            obj.put("paused", mExoPlayer != null && !mExoPlayer.isPlaying());
            obj.put("episodeIndex", mEpisodeIndex);
            obj.put("seriesId", mSeriesId);
            obj.put("seriesName", mSeriesName);
            if (mEpisodes.size() > 0 && mEpisodeIndex >= 0 && mEpisodeIndex < mEpisodes.size()) {
                NativeEpisode ep = mEpisodes.get(mEpisodeIndex);
                obj.put("itemId", ep.id);
                obj.put("season", ep.season);
                obj.put("episodeNumber", ep.episodeNumber);
                obj.put("episodeTitle", ep.title);
                obj.put("seriesId", ep.seriesId);
                obj.put("seriesName", ep.seriesName);
            }
            MainActivity.notifyNativePlayerProgress(obj.toString());
        } catch (Exception ignored) {}
    }

    private String formatTime(long ms) {
        if (ms <= 0) return "00:00:00";
        long totalSec = ms / 1000;
        long sec = totalSec % 60;
        long min = (totalSec / 60) % 60;
        long hrs = totalSec / 3600;
        return String.format(Locale.US, "%02d:%02d:%02d", hrs, min, sec);
    }

    private void parseEpisodeList(String json) {
        if (json == null || json.trim().isEmpty()) return;
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                JSONObject o = array.optJSONObject(i);
                if (o == null) continue;
                NativeEpisode ep = new NativeEpisode();
                ep.id = o.optString("id", "");
                ep.url = o.optString("url", "");
                ep.title = o.optString("title", "Episode " + (i + 1));
                ep.season = o.optString("season", "1");
                ep.episodeNumber = o.optInt("episodeNumber", i + 1);
                ep.seriesId = o.optString("seriesId", mSeriesId);
                ep.seriesName = o.optString("seriesName", mSeriesName);
                if (!ep.url.isEmpty()) mEpisodes.add(ep);
            }
            if (mEpisodeIndex >= mEpisodes.size()) mEpisodeIndex = Math.max(0, mEpisodes.size() - 1);
            if (mEpisodes.size() > 0) {
                NativeEpisode current = mEpisodes.get(mEpisodeIndex);
                if (mItemId.isEmpty()) mItemId = current.id;
                if (mSeriesId.isEmpty()) mSeriesId = current.seriesId;
                if (mSeriesName.isEmpty()) mSeriesName = current.seriesName;
            }
            if (mSeriesName.isEmpty() && "series".equalsIgnoreCase(mContentType)) {
                int separator = mTitle.indexOf(" - ");
                if (separator > 0) mSeriesName = mTitle.substring(0, separator);
            }
        } catch (Exception e) {
            Log.e(TAG, "Episode list parse failed: " + e.getMessage());
        }
    }

    private void playAdjacentEpisode(int delta) {
        if (mEpisodes.size() == 0) {
            Toast.makeText(this, "Episode navigation is available for series only", Toast.LENGTH_SHORT).show();
            return;
        }
        int next = mEpisodeIndex + delta;
        if (next < 0 || next >= mEpisodes.size()) {
            Toast.makeText(this, next < 0 ? "Already at the first episode" : "Already at the last episode", Toast.LENGTH_SHORT).show();
            showOsd(4000);
            return;
        }
        mEpisodeIndex = next;
        NativeEpisode ep = mEpisodes.get(mEpisodeIndex);
        mStreamUrl = ep.url;
        mItemId = ep.id;
        mTitle = (mSeriesName == null || mSeriesName.isEmpty() ? "Series" : mSeriesName) + " - " + ep.title;
        mSeriesId = ep.seriesId;
        if (mTitleText != null) mTitleText.setText(mTitle);
        if (mExoPlayer != null) {
            mExoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(mStreamUrl)));
            mExoPlayer.prepare();
            mExoPlayer.play();
        }
        Toast.makeText(this, (delta > 0 ? "Next episode: " : "Previous episode: ") + ep.title, Toast.LENGTH_SHORT).show();
        showOsd(4000);
        sendProgressCallback(0, 0);
    }

    private static class NativeEpisode {
        String id = "";
        String url = "";
        String title = "";
        String season = "1";
        int episodeNumber = 0;
        String seriesId = "";
        String seriesName = "";
    }

    private void setPlayerVolume(float value) {
        if (mExoPlayer == null) return;
        mExoPlayer.setVolume(Math.max(0.0f, Math.min(1.0f, value)));
        if (value > 0.0f) mLastVolume = value;
        showOsd(4000);
        sendProgressCallback(mExoPlayer.getCurrentPosition(), mExoPlayer.getDuration());
        Log.i(TAG, "Remote volume set to " + value);
    }

    private void toggleMute() {
        if (mExoPlayer == null) return;
        float current = mExoPlayer.getVolume();
        if (current > 0.001f) {
            mLastVolume = current;
            mExoPlayer.setVolume(0.0f);
            Log.i(TAG, "Remote mute enabled");
        } else {
            float restored = mLastVolume > 0.001f ? mLastVolume : 1.0f;
            mExoPlayer.setVolume(restored);
            Log.i(TAG, "Remote mute disabled; volume restored to " + restored);
        }
        showOsd(4000);
        sendProgressCallback(mExoPlayer.getCurrentPosition(), mExoPlayer.getDuration());
    }

    private void togglePlayPause() {
        if (mExoPlayer == null) return;
        if (mExoPlayer.isPlaying()) {
            mExoPlayer.pause();
            showOsd(0); // Keep OSD visible while paused
        } else {
            mExoPlayer.play();
            showOsd(3500);
        }
    }

    private void seekRelative(long deltaMs) {
        if (mExoPlayer == null) return;
        long cur = mExoPlayer.getCurrentPosition();
        seekToPosition(cur + deltaMs);
    }

    private void seekToPosition(final long positionMs) {
        if (mExoPlayer == null) return;
        mIsUserSeeking = true;
        final long dur = mExoPlayer.getDuration();
        long target = Math.max(0, positionMs);
        if (dur > 0 && target > dur) target = dur;

        Log.i(TAG, "seekToPosition: Seeking ExoPlayer to " + target + "ms / " + dur + "ms (" + formatTime(target) + ")");
        mExoPlayer.seekTo(target);
        mExoPlayer.setPlayWhenReady(true);

        if (dur > 0) {
            int progress = (int) ((target * 1000) / dur);
            if (mSeekBar != null) mSeekBar.setProgress(progress);
            if (mTimeCurrent != null) mTimeCurrent.setText(formatTime(target));
        }

        sendProgressCallback(target, dur > 0 ? dur : target);
        showOsd(4000);
        Toast.makeText(this, "Seek: " + formatTime(target), Toast.LENGTH_SHORT).show();

        mHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                mIsUserSeeking = false;
            }
        }, 1000);
    }

    private void toggleAspectRatio() {
        if (mExoPlayer == null) return;
        mAspectMode = (mAspectMode + 1) % 3;
        String modeName;
        if (mAspectMode == 0) {
            mExoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT);
            modeName = "Fit (16:9)";
        } else if (mAspectMode == 1) {
            mExoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);
            modeName = "Fill (Stretch/Crop)";
        } else {
            mExoPlayer.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT);
            modeName = "Original";
        }
        mBtnAspect.setText("📺 " + modeName);
        Toast.makeText(this, "Aspect Ratio: " + modeName, Toast.LENGTH_SHORT).show();
        showOsd(4000);
    }

    private void cycleAudioTrack() {
        if (mExoPlayer == null) return;
        try {
            Tracks tracks = mExoPlayer.getCurrentTracks();
            List<Tracks.Group> audioGroups = new ArrayList<>();
            for (Tracks.Group group : tracks.getGroups()) {
                if (group.getType() == C.TRACK_TYPE_AUDIO) {
                    audioGroups.add(group);
                }
            }
            if (audioGroups.isEmpty()) {
                if (mBtnAudio != null) mBtnAudio.setText("🎵 NO AUDIO");
                Toast.makeText(this, "No audio tracks available", Toast.LENGTH_SHORT).show();
                return;
            }
            mSelectedAudioIndex = (mSelectedAudioIndex + 1) % audioGroups.size();
            Tracks.Group selectedGroup = audioGroups.get(mSelectedAudioIndex);
            TrackSelectionOverride override = new TrackSelectionOverride(selectedGroup.getMediaTrackGroup(), 0);
            TrackSelectionParameters params = mExoPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
                    .addOverride(override)
                    .build();
            mExoPlayer.setTrackSelectionParameters(params);

            String lang = selectedGroup.getTrackFormat(0).language;
            if (lang == null || lang.isEmpty()) lang = "TRACK " + (mSelectedAudioIndex + 1);
            if (mBtnAudio != null) mBtnAudio.setText("🎵 " + lang.toUpperCase(Locale.ROOT));
            Toast.makeText(this, "Audio: " + lang.toUpperCase(Locale.ROOT), Toast.LENGTH_SHORT).show();
            showOsd(4000);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cycle audio track: " + e.getMessage());
        }
    }

    private void cycleSubtitleTrack() {
        if (mExoPlayer == null) return;
        try {
            Tracks tracks = mExoPlayer.getCurrentTracks();
            List<Tracks.Group> textGroups = new ArrayList<>();
            for (Tracks.Group group : tracks.getGroups()) {
                if (group.getType() == C.TRACK_TYPE_TEXT) {
                    textGroups.add(group);
                }
            }
            if (textGroups.isEmpty()) {
                if (mBtnSub != null) mBtnSub.setText("💬 NO SUBS");
                Toast.makeText(this, "No subtitles available", Toast.LENGTH_SHORT).show();
                return;
            }
            mSelectedSubIndex++;
            if (mSelectedSubIndex >= textGroups.size()) {
                mSelectedSubIndex = -1; // wrap around to OFF
            }

            TrackSelectionParameters.Builder builder = mExoPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_TEXT);

            if (mSelectedSubIndex == -1) {
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true);
                if (mBtnSub != null) mBtnSub.setText("💬 SUB OFF");
                Toast.makeText(this, "Subtitles: OFF", Toast.LENGTH_SHORT).show();
            } else {
                Tracks.Group selectedGroup = textGroups.get(mSelectedSubIndex);
                TrackSelectionOverride override = new TrackSelectionOverride(selectedGroup.getMediaTrackGroup(), 0);
                builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false);
                builder.addOverride(override);
                String lang = selectedGroup.getTrackFormat(0).language;
                if (lang == null || lang.isEmpty()) lang = "SUB " + (mSelectedSubIndex + 1);
                if (mBtnSub != null) mBtnSub.setText("💬 " + lang.toUpperCase(Locale.ROOT));
                Toast.makeText(this, "Subtitle: " + lang.toUpperCase(Locale.ROOT), Toast.LENGTH_SHORT).show();
            }
            mExoPlayer.setTrackSelectionParameters(builder.build());
            showOsd(4000);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cycle subtitle track: " + e.getMessage());
        }
    }

    private void showOsd(long hideAfterMs) {
        if (mOsdRoot != null) {
            mOsdRoot.setVisibility(View.VISIBLE);
            mOsdRoot.bringToFront();
            if (mTopBar != null) mTopBar.bringToFront();
            if (mBottomBar != null) mBottomBar.bringToFront();
            mOsdRoot.requestLayout();
            mHandler.removeCallbacks(mHideOsdRunnable);
            if (hideAfterMs > 0 && mExoPlayer != null && mExoPlayer.isPlaying()) {
                mHandler.postDelayed(mHideOsdRunnable, hideAfterMs);
            }
        }
    }

    private void hideOsd() {
        if (mOsdRoot != null && mExoPlayer != null && mExoPlayer.isPlaying()) {
            mOsdRoot.setVisibility(View.GONE);
        }
    }

    private void openExternalPlayer() {
        if (mStreamUrl == null || mStreamUrl.isEmpty()) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(mStreamUrl), "video/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(Intent.createChooser(intent, "Play Stream With..."));
        } catch (Exception e) {
            Toast.makeText(this, "No external player app found (install VLC)", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        boolean isOsdVisible = (mOsdRoot != null && mOsdRoot.getVisibility() == View.VISIBLE);

        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE || keyCode == KeyEvent.KEYCODE_BUTTON_B) {
            closePlayerAndReturn();
            return true;
        }

        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER || keyCode == KeyEvent.KEYCODE_BUTTON_A) {
            if (!isOsdVisible) {
                showOsd(8000);
                if (mBtnPlayPause != null) mBtnPlayPause.requestFocus();
                return true;
            }
            View focused = getCurrentFocus();
            if (focused == mSeekBar && mExoPlayer != null && mExoPlayer.getDuration() > 0) {
                if (mPendingSeekRunnable != null) {
                    mHandler.removeCallbacks(mPendingSeekRunnable);
                    mPendingSeekRunnable = null;
                }
                long target = (long) (mExoPlayer.getDuration() * (mSeekBar.getProgress() / (double) mSeekBar.getMax()));
                seekToPosition(target);
                return true;
            }
            // If OSD is visible, normal button click handling applies
            return super.onKeyDown(keyCode, event);
        }

        if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY || keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE) {
            togglePlayPause();
            return true;
        }

        if (keyCode == KeyEvent.KEYCODE_DPAD_UP || keyCode == KeyEvent.KEYCODE_DPAD_DOWN) {
            showOsd(5000);
            View focused = getCurrentFocus();
            if (focused == null && mBtnPlayPause != null) {
                mBtnPlayPause.requestFocus();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_UP && focused != mSeekBar && mSeekBar != null && mSeekBar.getVisibility() == View.VISIBLE) {
                mSeekBar.requestFocus();
                return true;
            } else if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN && focused == mSeekBar && mBtnPlayPause != null) {
                mBtnPlayPause.requestFocus();
                return true;
            } else if (!isOsdVisible && mBtnPlayPause != null) {
                mBtnPlayPause.requestFocus();
                return true;
            }
            return true;
        }

        if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
            showOsd(8000);
            if (!isOsdVisible) {
                long delta = (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) ? 10000 : -10000;
                seekRelative(delta);
                if (mBtnPlayPause != null) mBtnPlayPause.requestFocus();
                return true;
            }
            View focused = getCurrentFocus();
            if (focused == mSeekBar && mExoPlayer != null && mExoPlayer.getDuration() > 0) {
                mIsUserSeeking = true;
                int step = 10;
                int next = mSeekBar.getProgress() + (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ? step : -step);
                int clamped = Math.max(0, Math.min(mSeekBar.getMax(), next));
                mSeekBar.setProgress(clamped);
                final long target = (long) (mExoPlayer.getDuration() * (clamped / (double) mSeekBar.getMax()));
                mTimeCurrent.setText(formatTime(target));
                if (mPendingSeekRunnable != null) {
                    mHandler.removeCallbacks(mPendingSeekRunnable);
                }
                mPendingSeekRunnable = new Runnable() {
                    @Override
                    public void run() {
                        seekToPosition(target);
                    }
                };
                mHandler.postDelayed(mPendingSeekRunnable, 250);
                return true;
            }
            // When OSD is visible, D-pad moves focus across buttons.
            return super.onKeyDown(keyCode, event);
        }

        return super.onKeyDown(keyCode, event);
    }

    private String getLocalizedPlayPauseText(boolean isPlaying) {
        String lang = getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE).getString("app_lang", "en");
        if (isPlaying) {
            if ("ar".equals(lang)) return "⏸ إيقاف";
            if ("es".equals(lang)) return "⏸ PAUSA";
            return "⏸ PAUSE";
        } else {
            if ("fr".equals(lang)) return "▶ LECTURE";
            if ("ar".equals(lang)) return "▶ تشغيل";
            if ("es".equals(lang)) return "▶ REPRODUCIR";
            if ("de".equals(lang)) return "▶ ABSPIELEN";
            return "▶ PLAY";
        }
    }

    private String getLocalizedButton(String action) {
        String lang = getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE).getString("app_lang", "en");
        if ("fr".equals(lang)) {
            if ("exit".equals(action)) return "✖ QUITTER";
            if ("aspect".equals(action)) return "📺 FORMAT";
            if ("audio".equals(action)) return "🎵 AUDIO";
            if ("sub".equals(action)) return "💬 SOUS-TITRES";
            if ("prev_ep".equals(action)) return "⏮ ÉP PRÉC";
            if ("next_ep".equals(action)) return "⏭ ÉP SUIV";
        } else if ("ar".equals(lang)) {
            if ("exit".equals(action)) return "✖ خروج";
            if ("aspect".equals(action)) return "📺 الأبعاد";
            if ("audio".equals(action)) return "🎵 الصوت";
            if ("sub".equals(action)) return "💬 الترجمة";
            if ("prev_ep".equals(action)) return "⏮ الحلقة السابقة";
            if ("next_ep".equals(action)) return "⏭ الحلقة التالية";
        } else if ("es".equals(lang)) {
            if ("exit".equals(action)) return "✖ SALIR";
            if ("aspect".equals(action)) return "📺 FORMATO";
            if ("audio".equals(action)) return "🎵 AUDIO";
            if ("sub".equals(action)) return "💬 SUB";
            if ("prev_ep".equals(action)) return "⏮ EP ANT";
            if ("next_ep".equals(action)) return "⏭ EP SIG";
        } else if ("de".equals(lang)) {
            if ("exit".equals(action)) return "✖ BEENDEN";
            if ("aspect".equals(action)) return "📺 FORMAT";
            if ("audio".equals(action)) return "🎵 AUDIO";
            if ("sub".equals(action)) return "💬 UT";
            if ("prev_ep".equals(action)) return "⏮ VORH EP";
            if ("next_ep".equals(action)) return "⏭ NÄCH EP";
        }
        if ("exit".equals(action)) return "✖ EXIT";
        if ("aspect".equals(action)) return "📺 ASPECT";
        if ("audio".equals(action)) return "🎵 AUDIO";
        if ("sub".equals(action)) return "💬 SUB";
        if ("prev_ep".equals(action)) return "⏮ PREV EP";
        if ("next_ep".equals(action)) return "⏭ NEXT EP";
        return action;
    }

    private String getLocalizedStatus(String resLabel) {
        String lang = getSharedPreferences("nidalplayer_prefs", MODE_PRIVATE).getString("app_lang", "en");
        String res = (resLabel != null && !resLabel.isEmpty()) ? resLabel : "1080p FHD";
        if ("fr".equals(lang)) {
            String type = mIsLive ? "TÉLÉ EN DIRECT" : "VOD";
            return type + "  |  " + res + "  |  [OK] Menu  |  [RETOUR] Quitter";
        } else if ("ar".equals(lang)) {
            String type = mIsLive ? "بث مباشر" : "فيديو";
            return type + "  |  " + res + "  |  [OK] القائمة  |  [BACK] خروج";
        } else if ("es".equals(lang)) {
            String type = mIsLive ? "TV EN VIVO" : "VOD";
            return type + "  |  " + res + "  |  [OK] Menú  |  [VOLVER] Salir";
        } else if ("de".equals(lang)) {
            String type = mIsLive ? "LIVE-TV" : "VOD";
            return type + "  |  " + res + "  |  [OK] Menü  |  [ZURÜCK] Beenden";
        }
        String type = mIsLive ? "LIVE TV" : "VOD";
        return type + "  |  " + res + "  |  [OK] Show Menu  |  [BACK] Exit";
    }

    private void closePlayerAndReturn() {
        if (mIsClosing) return;
        mIsClosing = true;
        if (mHandler != null) mHandler.removeCallbacksAndMessages(null);
        if (mExoPlayer != null) mExoPlayer.stop();
        setResult(Activity.RESULT_OK);
        finish();
    }

    @Override
    public void onBackPressed() {
        closePlayerAndReturn();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mExoPlayer != null) {
            mExoPlayer.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (sActiveInstance == this) sActiveInstance = null;
        mHandler.removeCallbacksAndMessages(null);
        if (mExoPlayer != null) {
            mExoPlayer.stop();
            mExoPlayer.release();
            mExoPlayer = null;
        }
    }
}
