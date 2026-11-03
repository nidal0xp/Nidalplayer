!include MUI2.nsh

; Glass Edition palette - must be defined before any wizard page is inserted
!define MUI_BGCOLOR "05070D"
!define MUI_TEXTCOLOR "F2F4F8"
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Nidalplayer ${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "A precision 4K IPTV and VOD media player with hardware-accelerated playback and a refined glass interface.$\r$\n$\r$\nThis setup installs Nidalplayer on this PC. Your playlists, credentials and watch history are preserved.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; MUI cannot recolor the themed finish checkbox, so launch is an explicit button
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Nidalplayer is ready"
  !define MUI_FINISHPAGE_TEXT "Nidalplayer ${VERSION} has been installed on this PC.$\r$\n$\r$\nClick Launch App to start streaming in 4K."
  !define MUI_FINISHPAGE_BUTTON "Launch App"
  !define MUI_FINISHPAGE_CANCEL_ENABLED
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE LaunchNidalplayer
  !insertmacro MUI_PAGE_FINISH

  Function LaunchNidalplayer
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd
!macroend

!define MUI_UNWELCOMEPAGE_TITLE "Uninstall Nidalplayer"
!define MUI_UNWELCOMEPAGE_TEXT "This removes Nidalplayer ${VERSION} from this PC.$\r$\n$\r$\nYour playlists, credentials and watch history will be kept.$\r$\n$\r$\nClick Uninstall to continue."

!define MUI_UNFINISHPAGE_TITLE "Nidalplayer has been removed"
!define MUI_UNFINISHPAGE_TEXT "Nidalplayer was uninstalled from this PC.$\r$\n$\r$\nYour playlists and watch history were kept. You can reinstall at any time."
