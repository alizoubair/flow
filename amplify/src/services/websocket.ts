/**
 * WebSocket Service for real-time agent communication
 */

import { WebSocketMessage, AgentExecutionMessage } from '../types/websocket';

const WS_API_URL = process.env.REACT_APP_WS_API_URL || 'wss://your-websocket-api.execute-api.us-west-2.amazonaws.com/dev';

type MessageHandler = (message: any) => void;
type ErrorHandler = (error: Error) => void;
type CloseHandler = () => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private closeHandlers: Set<CloseHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isIntentionallyClosed = false;
  private connectionId: string | null = null;

  /**
   * Connect to WebSocket API with authentication
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Get Cognito access token for authentication (contains client_id claim required by runtime)
        const accessToken = localStorage.getItem('flow-access-token');

        if (!accessToken) {
          console.warn('No authentication token found, connecting anonymously');
        }

        // Add token as query parameter for WebSocket authentication
        const url = accessToken ? `${WS_API_URL}?token=${encodeURIComponent(accessToken)}` : WS_API_URL;
        this.ws = new WebSocket(url);
        this.isIntentionallyClosed = false;

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Store connection ID from initial connection
            if (data.connectionId) {
              this.connectionId = data.connectionId;
            }

            // Notify all registered handlers
            this.messageHandlers.forEach(handler => handler(data));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          const error = new Error('WebSocket connection error');
          this.errorHandlers.forEach(handler => handler(error));
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.connectionId = null;
          this.closeHandlers.forEach(handler => handler());

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send message to WebSocket API
   */
  send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    this.ws!.send(JSON.stringify(message));
  }

  /**
   * Trigger agent execution with a prompt
   */
  executeAgent(prompt: string, pipelineId?: string): void {
    const message: WebSocketMessage = {
      action: 'orchestrator',  // Route to orchestrator Lambda
      operation: 'execute_pipeline',  // Internal operation type
      payload: {
        prompt,
        generate: true,  // Flag to indicate this is a generation request
      },
    };

    if (pipelineId) {
      message.pipeline_id = pipelineId;
    }

    this.send(message);
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Register a close handler
   */
  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  /**
   * Get connection ID
   */
  getConnectionId(): string | null {
    return this.connectionId;
  }
}

// Singleton instance
export const wsService = new WebSocketService();
