!include MUI2.nsh

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Nidalplayer 4.0 Setup"
  !define MUI_WELCOMEPAGE_TEXT "Nidalplayer is a precision 4K IPTV and VOD Media Player.$\r$\n$\r$\nThis setup will install Nidalplayer on your system with hardware-accelerated playback and fast caching.$\r$\n$\r$\nYour existing playlists, credentials, and watch history are preserved.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend
