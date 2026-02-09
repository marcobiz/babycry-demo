import { NextRequest, NextResponse } from 'next/server'

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'marcobiz'
const GITHUB_REPO = process.env.GITHUB_REPO || 'babycry-demo'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({
        error: 'GitHub token not configured',
        hint: 'Set GITHUB_TOKEN environment variable'
      }, { status: 500 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 })
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    console.log(`[${requestId}] Starting analysis, audio size: ${arrayBuffer.byteLength} bytes`)

    // Trigger GitHub Actions workflow
    const dispatchResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'analyze-audio',
          client_payload: {
            audio: base64Audio,
            request_id: requestId
          }
        })
      }
    )

    if (!dispatchResponse.ok) {
      const error = await dispatchResponse.text()
      console.error('Dispatch failed:', error)
      return NextResponse.json({
        error: 'Failed to trigger analysis',
        details: error
      }, { status: 500 })
    }

    console.log(`[${requestId}] Workflow triggered, waiting for completion...`)

    // Poll for workflow completion (max 3 minutes)
    const result = await pollForResult(requestId, 180)

    if (result) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json({
        error: 'Analysis timeout',
        requestId,
        hint: 'Check GitHub Actions for status'
      }, { status: 504 })
    }

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function pollForResult(requestId: string, maxSeconds: number): Promise<any> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds

  while ((Date.now() - startTime) < maxSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    try {
      // Get recent workflow runs
      const runsResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?event=repository_dispatch&per_page=5`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      )

      if (!runsResponse.ok) continue

      const runsData = await runsResponse.json()

      for (const run of runsData.workflow_runs || []) {
        if (run.status === 'completed' && run.conclusion === 'success') {
          // Check artifacts for our request
          const artifactsResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${run.id}/artifacts`,
            {
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
              }
            }
          )

          if (!artifactsResponse.ok) continue

          const artifactsData = await artifactsResponse.json()

          for (const artifact of artifactsData.artifacts || []) {
            if (artifact.name === `prediction-${requestId}`) {
              // Download artifact
              const downloadResponse = await fetch(artifact.archive_download_url, {
                headers: {
                  'Authorization': `Bearer ${GITHUB_TOKEN}`,
                  'Accept': 'application/vnd.github.v3+json',
                }
              })

              if (downloadResponse.ok) {
                // Artifact is a zip file, need to extract
                const zipBuffer = await downloadResponse.arrayBuffer()
                const result = await extractResultFromZip(zipBuffer)
                if (result) return result
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Poll error:', error)
    }
  }

  return null
}

async function extractResultFromZip(zipBuffer: ArrayBuffer): Promise<any> {
  // Simple zip extraction for single JSON file
  // GitHub artifacts are zipped
  try {
    const { Readable } = await import('stream')
    const AdmZip = (await import('adm-zip')).default

    const zip = new AdmZip(Buffer.from(zipBuffer))
    const entries = zip.getEntries()

    for (const entry of entries) {
      if (entry.entryName.endsWith('.json')) {
        const content = entry.getData().toString('utf8')
        return JSON.parse(content)
      }
    }
  } catch (error) {
    console.error('Zip extraction error:', error)
  }
  return null
}
