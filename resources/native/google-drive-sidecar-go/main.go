package main

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "net/http"
  "net/url"
  "os"
  "os/signal"
  "path/filepath"
  "strconv"
  "strings"
  "syscall"
  "time"
)

type config struct {
  clientID            string
  clientSecret        string
  scopes              string
  once                bool
  printAuthURL        bool
  exchangeCode        string
  exchangeCallbackURL string
  state               string
  tokenCacheDir       string
  redirectURI         string
  listFilesJSON       bool
  listDocsJSON        bool
  listSheetsJSON      bool
  listGmailMessagesJSON bool
  listCalendarsJSON   bool
  limit               int64
}

type cachedToken struct {
  AccessToken  string `json:"access_token"`
  RefreshToken string `json:"refresh_token,omitempty"`
  TokenType    string `json:"token_type,omitempty"`
  Expiry       string `json:"expiry,omitempty"`
  Scope        string `json:"scope,omitempty"`
}

type tokenResponse struct {
  AccessToken  string `json:"access_token"`
  RefreshToken string `json:"refresh_token,omitempty"`
  ExpiresIn    int64  `json:"expires_in,omitempty"`
  Scope        string `json:"scope,omitempty"`
  TokenType    string `json:"token_type,omitempty"`
}

type authURLPayload struct {
  AuthURL     string `json:"auth_url"`
  State       string `json:"state"`
  RedirectURI string `json:"redirect_uri"`
  TokenCache  string `json:"token_cache_path"`
}

type exchangePayload struct {
  TokenCache string `json:"token_cache_path"`
  ScopeCount int    `json:"scope_count"`
}

type driveFile struct {
  ID               string   `json:"id"`
  Name             string   `json:"name"`
  MimeType         string   `json:"mimeType"`
  ModifiedTime     string   `json:"modifiedTime,omitempty"`
  CreatedTime      string   `json:"createdTime,omitempty"`
  ModifiedByMeTime string   `json:"modifiedByMeTime,omitempty"`
  WebViewLink      string   `json:"webViewLink,omitempty"`
  IconLink         string   `json:"iconLink,omitempty"`
  DriveID          string   `json:"driveId,omitempty"`
  Parents          []string `json:"parents,omitempty"`
  OwnerNames       []string `json:"ownerNames,omitempty"`
  SizeBytes        int64    `json:"sizeBytes,omitempty"`
  Shared           bool     `json:"shared,omitempty"`
  Starred          bool     `json:"starred,omitempty"`
  Trashed          bool     `json:"trashed,omitempty"`
}

type driveListPayload struct {
  Files []driveFile `json:"files"`
}

type driveAPIResponse struct {
  Files []struct {
    ID               string `json:"id"`
    Name             string `json:"name"`
    MimeType         string `json:"mimeType"`
    ModifiedTime     string `json:"modifiedTime"`
    CreatedTime      string `json:"createdTime"`
    ModifiedByMeTime string `json:"modifiedByMeTime"`
    WebViewLink      string `json:"webViewLink"`
    IconLink         string `json:"iconLink"`
    DriveID          string `json:"driveId"`
    Parents          []string `json:"parents"`
    Owners          []struct {
      DisplayName  string `json:"displayName"`
      EmailAddress string `json:"emailAddress"`
    } `json:"owners"`
    Size    string `json:"size"`
    Shared  bool   `json:"shared"`
    Starred bool   `json:"starred"`
    Trashed bool   `json:"trashed"`
  } `json:"files"`
}

func parseConfig() config {
  cfg := config{}
  flag.StringVar(&cfg.clientID, "client-id", "", "Google OAuth client ID")
  flag.StringVar(&cfg.clientSecret, "client-secret", "", "Google OAuth client secret")
  flag.StringVar(&cfg.scopes, "scopes", "https://www.googleapis.com/auth/drive.metadata.readonly", "Comma-separated Google scopes")
  flag.BoolVar(&cfg.once, "once", false, "Print a single startup summary and exit")
  flag.BoolVar(&cfg.printAuthURL, "print-auth-url", false, "Print OAuth authorization URL as JSON")
  flag.StringVar(&cfg.exchangeCode, "exchange-code", "", "Exchange an OAuth authorization code")
  flag.StringVar(&cfg.exchangeCallbackURL, "exchange-callback-url", "", "Exchange an OAuth callback URL containing code/state")
  flag.StringVar(&cfg.state, "state", "", "OAuth state to validate or emit")
  flag.StringVar(&cfg.tokenCacheDir, "token-cache-dir", ".", "Directory for token cache")
  flag.StringVar(&cfg.redirectURI, "redirect-uri", "http://127.0.0.1:8789/callback", "OAuth redirect URI")
  flag.BoolVar(&cfg.listFilesJSON, "list-files-json", false, "List Drive files as JSON using cached OAuth token")
  flag.BoolVar(&cfg.listDocsJSON, "list-docs-json", false, "List Google Docs files as JSON using cached OAuth token")
  flag.BoolVar(&cfg.listSheetsJSON, "list-sheets-json", false, "List Google Sheets files as JSON using cached OAuth token")
  flag.BoolVar(&cfg.listGmailMessagesJSON, "list-gmail-messages-json", false, "List Gmail messages as JSON using cached OAuth token")
  flag.BoolVar(&cfg.listCalendarsJSON, "list-calendars-json", false, "List Google Calendar entries as JSON using cached OAuth token")
  flag.Int64Var(&cfg.limit, "limit", 20, "Maximum files to return for Drive listing")
  flag.Parse()
  return cfg
}

func validateConfig(cfg config) error {
  if strings.TrimSpace(cfg.clientID) == "" {
    return fmt.Errorf("missing --client-id")
  }
  if strings.TrimSpace(cfg.clientSecret) == "" {
    return fmt.Errorf("missing --client-secret")
  }
  return nil
}

func normalizeScopes(raw string) []string {
  parts := strings.Split(raw, ",")
  scopes := make([]string, 0, len(parts))
  for _, part := range parts {
    trimmed := strings.TrimSpace(part)
    if trimmed != "" {
      scopes = append(scopes, trimmed)
    }
  }
  if len(scopes) == 0 {
    return []string{"https://www.googleapis.com/auth/drive.metadata.readonly"}
  }
  return scopes
}

func tokenCachePath(cfg config) string {
  return filepath.Join(cfg.tokenCacheDir, "google-drive-token.json")
}

func ensureTokenCacheDir(cfg config) error {
  return os.MkdirAll(cfg.tokenCacheDir, 0o755)
}

func writeJSON(value any) error {
  encoder := json.NewEncoder(os.Stdout)
  encoder.SetIndent("", "  ")
  return encoder.Encode(value)
}

func readCachedToken(cfg config) (*cachedToken, error) {
  data, err := os.ReadFile(tokenCachePath(cfg))
  if err != nil {
    return nil, err
  }
  token := &cachedToken{}
  if err := json.Unmarshal(data, token); err != nil {
    return nil, err
  }
  return token, nil
}

func writeCachedToken(cfg config, token *cachedToken) error {
  if err := ensureTokenCacheDir(cfg); err != nil {
    return err
  }
  data, err := json.MarshalIndent(token, "", "  ")
  if err != nil {
    return err
  }
  return os.WriteFile(tokenCachePath(cfg), data, 0o600)
}

func extractCodeAndState(callbackURL string) (string, string, error) {
  parsed, err := url.Parse(callbackURL)
  if err != nil {
    return "", "", err
  }
  code := parsed.Query().Get("code")
  state := parsed.Query().Get("state")
  if code == "" {
    return "", "", errors.New("callback URL missing code")
  }
  return code, state, nil
}

func buildAuthURL(cfg config) string {
  values := url.Values{}
  values.Set("client_id", cfg.clientID)
  values.Set("redirect_uri", cfg.redirectURI)
  values.Set("response_type", "code")
  values.Set("scope", strings.Join(normalizeScopes(cfg.scopes), " "))
  values.Set("access_type", "offline")
  values.Set("prompt", "consent")
  if strings.TrimSpace(cfg.state) != "" {
    values.Set("state", cfg.state)
  }
  return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode()
}

func tokenRequest(ctx context.Context, values url.Values) (*tokenResponse, error) {
  req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", bytes.NewBufferString(values.Encode()))
  if err != nil {
    return nil, err
  }
  req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return nil, err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return nil, err
  }
  if res.StatusCode >= 400 {
    return nil, fmt.Errorf("token endpoint error: %s", strings.TrimSpace(string(body)))
  }
  payload := &tokenResponse{}
  if err := json.Unmarshal(body, payload); err != nil {
    return nil, err
  }
  return payload, nil
}

func cachedTokenFromResponse(resp *tokenResponse, previous *cachedToken) *cachedToken {
  refreshToken := resp.RefreshToken
  if refreshToken == "" && previous != nil {
    refreshToken = previous.RefreshToken
  }
  expiry := ""
  if resp.ExpiresIn > 0 {
    expiry = time.Now().Add(time.Duration(resp.ExpiresIn) * time.Second).UTC().Format(time.RFC3339)
  } else if previous != nil {
    expiry = previous.Expiry
  }
  return &cachedToken{
    AccessToken:  resp.AccessToken,
    RefreshToken: refreshToken,
    TokenType:    resp.TokenType,
    Expiry:       expiry,
    Scope:        resp.Scope,
  }
}

func handlePrintAuthURL(cfg config) error {
  state := cfg.state
  if strings.TrimSpace(state) == "" {
    state = fmt.Sprintf("contextgo-google-drive-%d", time.Now().Unix())
  }
  cfg.state = state
  return writeJSON(authURLPayload{
    AuthURL:     buildAuthURL(cfg),
    State:       state,
    RedirectURI: cfg.redirectURI,
    TokenCache:  tokenCachePath(cfg),
  })
}

func handleExchange(ctx context.Context, cfg config) error {
  code := strings.TrimSpace(cfg.exchangeCode)
  callbackState := ""
  if code == "" && strings.TrimSpace(cfg.exchangeCallbackURL) != "" {
    parsedCode, parsedState, err := extractCodeAndState(cfg.exchangeCallbackURL)
    if err != nil {
      return err
    }
    code = parsedCode
    callbackState = parsedState
  }
  if code == "" {
    return errors.New("missing exchange code or callback URL")
  }
  if cfg.state != "" && callbackState != "" && cfg.state != callbackState {
    return fmt.Errorf("oauth state mismatch")
  }
  values := url.Values{}
  values.Set("client_id", cfg.clientID)
  values.Set("client_secret", cfg.clientSecret)
  values.Set("code", code)
  values.Set("grant_type", "authorization_code")
  values.Set("redirect_uri", cfg.redirectURI)
  tokenResp, err := tokenRequest(ctx, values)
  if err != nil {
    return err
  }
  token := cachedTokenFromResponse(tokenResp, nil)
  if err := writeCachedToken(cfg, token); err != nil {
    return err
  }
  return writeJSON(exchangePayload{TokenCache: tokenCachePath(cfg), ScopeCount: len(normalizeScopes(cfg.scopes))})
}

func refreshIfNeeded(ctx context.Context, cfg config, token *cachedToken) (*cachedToken, error) {
  if token == nil {
    return nil, errors.New("missing cached token")
  }
  if token.Expiry == "" {
    return token, nil
  }
  expiry, err := time.Parse(time.RFC3339, token.Expiry)
  if err != nil || time.Now().Before(expiry.Add(-1*time.Minute)) {
    return token, nil
  }
  if strings.TrimSpace(token.RefreshToken) == "" {
    return token, nil
  }
  values := url.Values{}
  values.Set("client_id", cfg.clientID)
  values.Set("client_secret", cfg.clientSecret)
  values.Set("refresh_token", token.RefreshToken)
  values.Set("grant_type", "refresh_token")
  tokenResp, err := tokenRequest(ctx, values)
  if err != nil {
    return nil, err
  }
  next := cachedTokenFromResponse(tokenResp, token)
  if err := writeCachedToken(cfg, next); err != nil {
    return nil, err
  }
  return next, nil
}



func handleListSheets(ctx context.Context, cfg config) error {
  token, err := readCachedToken(cfg)
  if err != nil {
    return fmt.Errorf("failed to read cached token: %w", err)
  }
  token, err = refreshIfNeeded(ctx, cfg, token)
  if err != nil {
    return err
  }
  requestURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files?pageSize=%d&q=mimeType%%3D%%27application%%2Fvnd.google-apps.spreadsheet%%27%%20and%%20trashed%%3Dfalse&fields=files(id,name,mimeType,modifiedTime,createdTime,webViewLink,owners(displayName,emailAddress),size,starred,trashed)&orderBy=modifiedTime%%20desc", cfg.limit)
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
  if err != nil {
    return err
  }
  req.Header.Set("Authorization", "Bearer "+token.AccessToken)
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return err
  }
  if res.StatusCode >= 400 {
    return fmt.Errorf("drive sheets query error: %s", strings.TrimSpace(string(body)))
  }
  payload := &driveAPIResponse{}
  if err := json.Unmarshal(body, payload); err != nil {
    return err
  }
  files := make([]driveFile, 0, len(payload.Files))
  for _, file := range payload.Files {
    ownerNames := make([]string, 0, len(file.Owners))
    for _, owner := range file.Owners {
      if strings.TrimSpace(owner.DisplayName) != "" {
        ownerNames = append(ownerNames, owner.DisplayName)
      } else if strings.TrimSpace(owner.EmailAddress) != "" {
        ownerNames = append(ownerNames, owner.EmailAddress)
      }
    }
    var sizeBytes int64
    if strings.TrimSpace(file.Size) != "" {
      if parsed, err := strconv.ParseInt(file.Size, 10, 64); err == nil {
        sizeBytes = parsed
      }
    }
    files = append(files, driveFile{ID: file.ID, Name: file.Name, MimeType: file.MimeType, ModifiedTime: file.ModifiedTime, CreatedTime: file.CreatedTime, WebViewLink: file.WebViewLink, OwnerNames: ownerNames, SizeBytes: sizeBytes, Starred: file.Starred, Trashed: file.Trashed})
  }
  return writeJSON(driveListPayload{Files: files})
}

type gmailMessage struct {
  ID           string   `json:"id"`
  ThreadID     string   `json:"threadId,omitempty"`
  Subject      string   `json:"subject,omitempty"`
  From         string   `json:"from,omitempty"`
  Snippet      string   `json:"snippet,omitempty"`
  InternalDate string   `json:"internalDate,omitempty"`
  LabelIDs     []string `json:"labelIds,omitempty"`
}

type gmailMessagesPayload struct {
  Messages []gmailMessage `json:"messages"`
}

func handleListGmailMessages(ctx context.Context, cfg config) error {
  token, err := readCachedToken(cfg)
  if err != nil {
    return fmt.Errorf("failed to read cached token: %w", err)
  }
  token, err = refreshIfNeeded(ctx, cfg, token)
  if err != nil {
    return err
  }
  listURL := fmt.Sprintf("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=%d", cfg.limit)
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, listURL, nil)
  if err != nil {
    return err
  }
  req.Header.Set("Authorization", "Bearer "+token.AccessToken)
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return err
  }
  if res.StatusCode >= 400 {
    return fmt.Errorf("gmail messages error: %s", strings.TrimSpace(string(body)))
  }
  payload := &struct {
    Messages []struct {
      ID       string `json:"id"`
      ThreadID string `json:"threadId"`
    } `json:"messages"`
  }{}
  if err := json.Unmarshal(body, payload); err != nil {
    return err
  }

  messages := make([]gmailMessage, 0, len(payload.Messages))
  for _, entry := range payload.Messages {
    detailReq, err := http.NewRequestWithContext(
      ctx,
      http.MethodGet,
      fmt.Sprintf("https://gmail.googleapis.com/gmail/v1/users/me/messages/%s?format=metadata&metadataHeaders=Subject&metadataHeaders=From", entry.ID),
      nil,
    )
    if err != nil {
      return err
    }
    detailReq.Header.Set("Authorization", "Bearer "+token.AccessToken)
    detailRes, err := http.DefaultClient.Do(detailReq)
    if err != nil {
      return err
    }
    detailBody, err := io.ReadAll(detailRes.Body)
    detailRes.Body.Close()
    if err != nil {
      return err
    }
    if detailRes.StatusCode >= 400 {
      return fmt.Errorf("gmail message detail error: %s", strings.TrimSpace(string(detailBody)))
    }

    detailPayload := &struct {
      ID           string   `json:"id"`
      ThreadID     string   `json:"threadId"`
      Snippet      string   `json:"snippet"`
      InternalDate string   `json:"internalDate"`
      LabelIDs     []string `json:"labelIds"`
      Payload      struct {
        Headers []struct {
          Name  string `json:"name"`
          Value string `json:"value"`
        } `json:"headers"`
      } `json:"payload"`
    }{}
    if err := json.Unmarshal(detailBody, detailPayload); err != nil {
      return err
    }

    subject := ""
    from := ""
    for _, header := range detailPayload.Payload.Headers {
      switch strings.ToLower(header.Name) {
      case "subject":
        subject = header.Value
      case "from":
        from = header.Value
      }
    }

    messages = append(messages, gmailMessage{
      ID:           detailPayload.ID,
      ThreadID:     detailPayload.ThreadID,
      Subject:      subject,
      From:         from,
      Snippet:      detailPayload.Snippet,
      InternalDate: detailPayload.InternalDate,
      LabelIDs:     detailPayload.LabelIDs,
    })
  }

  return writeJSON(gmailMessagesPayload{Messages: messages})
}

type calendarEntry struct {
  ID              string `json:"id"`
  Summary         string `json:"summary"`
  Description     string `json:"description,omitempty"`
  TimeZone        string `json:"timeZone,omitempty"`
  AccessRole      string `json:"accessRole,omitempty"`
  Primary         bool   `json:"primary,omitempty"`
  BackgroundColor string `json:"backgroundColor,omitempty"`
}

type calendarListPayload struct {
  Items []calendarEntry `json:"items"`
}

func handleListCalendars(ctx context.Context, cfg config) error {
  token, err := readCachedToken(cfg)
  if err != nil {
    return fmt.Errorf("failed to read cached token: %w", err)
  }
  token, err = refreshIfNeeded(ctx, cfg, token)
  if err != nil {
    return err
  }
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/calendar/v3/users/me/calendarList", nil)
  if err != nil {
    return err
  }
  req.Header.Set("Authorization", "Bearer "+token.AccessToken)
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return err
  }
  if res.StatusCode >= 400 {
    return fmt.Errorf("calendar list error: %s", strings.TrimSpace(string(body)))
  }
  payload := &calendarListPayload{}
  if err := json.Unmarshal(body, payload); err != nil {
    return err
  }
  return writeJSON(payload)
}

func handleListDocs(ctx context.Context, cfg config) error {
  token, err := readCachedToken(cfg)
  if err != nil {
    return fmt.Errorf("failed to read cached token: %w", err)
  }
  token, err = refreshIfNeeded(ctx, cfg, token)
  if err != nil {
    return err
  }
  requestURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files?pageSize=%d&q=mimeType%%3D%%27application%%2Fvnd.google-apps.document%%27%%20and%%20trashed%%3Dfalse&fields=files(id,name,mimeType,modifiedTime,createdTime,webViewLink,owners(displayName,emailAddress),size,starred,trashed)&orderBy=modifiedTime%%20desc", cfg.limit)
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
  if err != nil {
    return err
  }
  req.Header.Set("Authorization", "Bearer "+token.AccessToken)
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return err
  }
  if res.StatusCode >= 400 {
    return fmt.Errorf("drive docs query error: %s", strings.TrimSpace(string(body)))
  }
  payload := &driveAPIResponse{}
  if err := json.Unmarshal(body, payload); err != nil {
    return err
  }
  files := make([]driveFile, 0, len(payload.Files))
  for _, file := range payload.Files {
    ownerNames := make([]string, 0, len(file.Owners))
    for _, owner := range file.Owners {
      if strings.TrimSpace(owner.DisplayName) != "" {
        ownerNames = append(ownerNames, owner.DisplayName)
      } else if strings.TrimSpace(owner.EmailAddress) != "" {
        ownerNames = append(ownerNames, owner.EmailAddress)
      }
    }
    var sizeBytes int64
    if strings.TrimSpace(file.Size) != "" {
      if parsed, err := strconv.ParseInt(file.Size, 10, 64); err == nil {
        sizeBytes = parsed
      }
    }
    files = append(files, driveFile{
      ID: file.ID,
      Name: file.Name,
      MimeType: file.MimeType,
      ModifiedTime: file.ModifiedTime,
      CreatedTime: file.CreatedTime,
      WebViewLink: file.WebViewLink,
      OwnerNames: ownerNames,
      SizeBytes: sizeBytes,
      Starred: file.Starred,
      Trashed: file.Trashed,
    })
  }
  return writeJSON(driveListPayload{Files: files})
}

func handleListFiles(ctx context.Context, cfg config) error {
  token, err := readCachedToken(cfg)
  if err != nil {
    return fmt.Errorf("failed to read cached token: %w", err)
  }
  token, err = refreshIfNeeded(ctx, cfg, token)
  if err != nil {
    return err
  }
  requestURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files?pageSize=%d&fields=files(id,name,mimeType,modifiedTime,createdTime,modifiedByMeTime,webViewLink,iconLink,driveId,parents,owners(displayName,emailAddress),size,shared,starred,trashed)&orderBy=modifiedTime%%20desc", cfg.limit)
  req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
  if err != nil {
    return err
  }
  req.Header.Set("Authorization", "Bearer "+token.AccessToken)
  res, err := http.DefaultClient.Do(req)
  if err != nil {
    return err
  }
  defer res.Body.Close()
  body, err := io.ReadAll(res.Body)
  if err != nil {
    return err
  }
  if res.StatusCode >= 400 {
    return fmt.Errorf("drive files.list error: %s", strings.TrimSpace(string(body)))
  }
  payload := &driveAPIResponse{}
  if err := json.Unmarshal(body, payload); err != nil {
    return err
  }
  files := make([]driveFile, 0, len(payload.Files))
  for _, file := range payload.Files {
    ownerNames := make([]string, 0, len(file.Owners))
    for _, owner := range file.Owners {
      if strings.TrimSpace(owner.DisplayName) != "" {
        ownerNames = append(ownerNames, owner.DisplayName)
        continue
      }
      if strings.TrimSpace(owner.EmailAddress) != "" {
        ownerNames = append(ownerNames, owner.EmailAddress)
      }
    }
    var sizeBytes int64
    if strings.TrimSpace(file.Size) != "" {
      if parsed, err := strconv.ParseInt(file.Size, 10, 64); err == nil {
        sizeBytes = parsed
      }
    }
    files = append(files, driveFile{
      ID: file.ID,
      Name: file.Name,
      MimeType: file.MimeType,
      ModifiedTime: file.ModifiedTime,
      CreatedTime: file.CreatedTime,
      ModifiedByMeTime: file.ModifiedByMeTime,
      WebViewLink: file.WebViewLink,
      IconLink: file.IconLink,
      DriveID: file.DriveID,
      Parents: file.Parents,
      OwnerNames: ownerNames,
      SizeBytes: sizeBytes,
      Shared: file.Shared,
      Starred: file.Starred,
      Trashed: file.Trashed,
    })
  }
  return writeJSON(driveListPayload{Files: files})
}

func runHeartbeat() {
  sigCh := make(chan os.Signal, 1)
  signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
  ticker := time.NewTicker(30 * time.Second)
  defer ticker.Stop()
  for {
    select {
    case <-ticker.C:
      fmt.Println("[contextgo-google-drive-sidecar] heartbeat")
    case <-sigCh:
      fmt.Println("[contextgo-google-drive-sidecar] shutdown")
      return
    }
  }
}

func main() {
  cfg := parseConfig()
  if err := validateConfig(cfg); err != nil {
    fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
    os.Exit(1)
  }
  ctx := context.Background()
  switch {
  case cfg.printAuthURL:
    if err := handlePrintAuthURL(cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.exchangeCode != "" || cfg.exchangeCallbackURL != "":
    if err := handleExchange(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.listFilesJSON:
    if err := handleListFiles(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.listDocsJSON:
    if err := handleListDocs(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.listSheetsJSON:
    if err := handleListSheets(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.listGmailMessagesJSON:
    if err := handleListGmailMessages(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.listCalendarsJSON:
    if err := handleListCalendars(ctx, cfg); err != nil {
      fmt.Fprintf(os.Stderr, "[contextgo-google-drive-sidecar] %v\n", err)
      os.Exit(1)
    }
    return
  case cfg.once:
    fmt.Printf("[contextgo-google-drive-sidecar] client_id=%s scopes=%s token_cache=%s\n", cfg.clientID, cfg.scopes, tokenCachePath(cfg))
    return
  default:
    fmt.Printf("[contextgo-google-drive-sidecar] client_id=%s scopes=%s token_cache=%s\n", cfg.clientID, cfg.scopes, tokenCachePath(cfg))
    runHeartbeat()
  }
}
