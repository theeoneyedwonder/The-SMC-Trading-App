; The SMC Trading App - Custom NSIS installer script
; Called by electron-builder before the installer UI is shown.
; Checks that MetaTrader 5 is present on this machine.

!macro customInit
  ; Check registry first. MT5 writes here on install.
  ReadRegStr $0 HKCU "Software\MetaQuotes\Terminal" ""
  StrCmp $0 "" 0 mt5_found

  ; Fallback: common install paths.
  IfFileExists "$PROGRAMFILES64\MetaTrader 5\terminal64.exe" mt5_found
  IfFileExists "$PROGRAMFILES\MetaTrader 5\terminal64.exe" mt5_found

  ; Not found: warn but do not block installation.
  MessageBox MB_OK|MB_ICONINFORMATION \
    "MetaTrader 5 does not appear to be installed.$\n$\n\
The SMC Trading App requires MetaTrader 5 to connect to your broker.$\n$\n\
You can finish installing the app now, but please install MetaTrader 5 \
from your broker before launching it."

  mt5_found:
!macroend

!macro customInstall
  ; Nothing extra needed after standard install.
!macroend
