// src/lib/sseManager.ts
// Server-Sent Events manager — pushes live updates to connected clients

import { Response } from 'express'

interface SSEClient {
  id:       string
  res:      Response
  role:     string
  userId:   string
  watchIds: string[]   // admission numbers this client cares about
  lastActivity: number // timestamp of last activity
}

// Cleanup interval: 60 seconds
const CLEANUP_INTERVAL = 60 * 1000
// Client timeout: 5 minutes of inactivity (heartbeat is every 25s, so 5min means missed 12 heartbeats)
const CLIENT_TIMEOUT = 5 * 60 * 1000

class SSEManager {
  private clients: Map<string, SSEClient> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanup()
  }

  private startCleanup() {
    // Start periodic cleanup of stale clients
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleClients()
    }, CLEANUP_INTERVAL)

    // Ensure cleanup interval is unref'd so it doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  private cleanupStaleClients() {
    const now = Date.now()
    let cleaned = 0

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > CLIENT_TIMEOUT) {
        try {
          client.res.end()
        } catch {
          // Client may already be disconnected
        }
        this.clients.delete(clientId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`[SSE] Cleanup: removed ${cleaned} stale client(s) | Active: ${this.clients.size}`)
    }
  }

  addClient(client: Omit<SSEClient, 'lastActivity'>) {
    const clientWithActivity: SSEClient = {
      ...client,
      lastActivity: Date.now(),
    }
    this.clients.set(client.id, clientWithActivity)
    console.log(`[SSE] Connected: ${client.id} (${client.role}) | Total: ${this.clients.size}`)
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId)
    console.log(`[SSE] Disconnected: ${clientId} | Total: ${this.clients.size}`)
  }

  // Update client's last activity timestamp (call on heartbeat)
  touchClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (client) {
      client.lastActivity = Date.now()
    }
  }

  private sendToClient(client: SSEClient, event: string, data: any) {
    try {
      client.res.write(`event: ${event}\n`)
      client.res.write(`data: ${JSON.stringify(data)}\n\n`)
      client.lastActivity = Date.now()
    } catch {
      this.removeClient(client.id)
    }
  }

  broadcastAttendanceUpdate(admissionNumber: string, data: any) {
    for (const client of this.clients.values()) {
      if (client.watchIds.includes(admissionNumber)) {
        this.sendToClient(client, 'attendance_updated', { admissionNumber, ...data })
      }
    }
    console.log(`[SSE] attendance_updated → ${admissionNumber}`)
  }

  broadcastResultUpdate(admissionNumber: string, data: any) {
    for (const client of this.clients.values()) {
      if (client.watchIds.includes(admissionNumber)) {
        this.sendToClient(client, 'result_updated', { admissionNumber, ...data })
      }
    }
    console.log(`[SSE] result_updated → ${admissionNumber}`)
  }

  broadcastNotice(data: any) {
    for (const client of this.clients.values()) {
      this.sendToClient(client, 'notice_posted', data)
    }
    console.log(`[SSE] notice_posted → ${this.clients.size} clients`)
  }

  broadcastRemarkUpdate(admissionNumber: string, data: any) {
    for (const client of this.clients.values()) {
      if (client.watchIds.includes(admissionNumber)) {
        this.sendToClient(client, 'remark_updated', { admissionNumber, ...data })
      }
    }
    console.log(`[SSE] remark_updated → ${admissionNumber}`)
  }

  // Generic broadcast to specific role(s)
  broadcast(event: string, data: any, targetRole?: string | string[]) {
    const roles = targetRole 
      ? (Array.isArray(targetRole) ? targetRole : [targetRole])
      : null

    let count = 0
    for (const client of this.clients.values()) {
      if (!roles || roles.includes(client.role)) {
        this.sendToClient(client, event, data)
        count++
      }
    }
    console.log(`[SSE] ${event} → ${count} clients${roles ? ` (${roles.join(', ')})` : ''}`)
  }

  // Send to a specific user by their userId
  sendToUser(userId: string, event: string, data: any) {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendToClient(client, event, data)
        count++
      }
    }
    console.log(`[SSE] ${event} → user ${userId} (${count} client(s))`)
  }

  // Broadcast to all connected clients
  broadcastAll(event: string, data: any) {
    for (const client of this.clients.values()) {
      this.sendToClient(client, event, data)
    }
    console.log(`[SSE] ${event} → ${this.clients.size} clients (all)`)
  }

  getClientCount() { return this.clients.size }

  // Get all connected client IDs (for debugging)
  getClientIds(): string[] {
    return Array.from(this.clients.keys())
  }

  // Stop cleanup interval (for graceful shutdown)
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  // Force cleanup all clients (for shutdown)
  disconnectAll() {
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.end()
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.clients.clear()
    console.log('[SSE] All clients disconnected')
  }
}

export const sseManager = new SSEManager()