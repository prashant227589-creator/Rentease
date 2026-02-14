$port = 8082
$root = "$PSScriptRoot"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "RentEase Pro started at http://localhost:$port/"

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContextAsync().Result
        $req = $ctx.Request
        $res = $ctx.Response
        
        $relativePath = $req.Url.LocalPath.TrimStart('/')
        if ($relativePath -eq "") { $relativePath = "index.html" }
        
        $path = Join-Path $root $relativePath
        
        if (Test-Path $path -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($path)
            $ext = [System.IO.Path]::GetExtension($path)
            switch ($ext) {
                ".html" { $res.ContentType = "text/html" }
                ".css" { $res.ContentType = "text/css" }
                ".js" { $res.ContentType = "application/javascript" }
            }
            $res.ContentLength64 = $content.Length
            $res.OutputStream.Write($content, 0, $content.Length)
        }
        else {
            $res.StatusCode = 404
        }
        $res.Close()
    }
}
finally {
    $listener.Stop()
}
