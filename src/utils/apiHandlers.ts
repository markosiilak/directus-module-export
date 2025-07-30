import axios from 'axios';
import type { ApiError, ImportLogEntry } from '../types';

/**
 * Validates a Directus admin token against a target server
 */
export async function validateDirectusToken(
  selectedDomain: string,
  adminToken: string
): Promise<{
  success: boolean;
  message: string;
  serverInfo?: {
    version: string;
    project: string;
  };
  error?: any;
}> {
  const validationLog: any[] = [];
  
  const logStep = (step: string, details: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      step,
      details,
    };
    validationLog.push(logEntry);
    console.log(`[${step}]`, details);
  };

  try {
    logStep('request_received', {
      selectedDomain,
      hasToken: !!adminToken,
    });

    if (!selectedDomain || !adminToken) {
      const error = {
        hasSelectedDomain: !!selectedDomain,
        hasAdminToken: !!adminToken,
      };
      logStep('validation_error', error);
      return {
        success: false,
        message: 'Missing required parameters: selectedDomain and adminToken',
        error: { validationLog }
      };
    }

    // Test connection to target server first
    logStep('connection_test_start', { domain: selectedDomain });
    try {
      // Test the connection by making a simple ping request
      const response = await axios.get(`${selectedDomain}/server/ping`, {
        headers: {
          Authorization: adminToken,
        },
        timeout: 5000,
      });

      if (response.status !== 200) {
        throw new Error(`Server returned status ${response.status}`);
      }

      logStep('connection_test_success', {
        status: response.status,
        responseTime: response.headers['x-response-time'] || 'unknown'
      });

      // Test admin token by trying to read collections
      logStep('token_validation_start', {});
      try {
        const collectionsResponse = await axios.get(`${selectedDomain}/collections`, {
          headers: {
            Authorization: adminToken,
          },
          timeout: 10000,
        });

        logStep('token_validation_success', {
          hasAccess: true,
          collectionCount: collectionsResponse.data?.data?.length || 0
        });

        // Get server info
        const serverInfoResponse = await axios.get(`${selectedDomain}/server/info`, {
          headers: {
            Authorization: adminToken,
          },
          timeout: 5000,
        });

        return {
          success: true,
          message: 'Token validation successful',
          serverInfo: {
            version: serverInfoResponse.data?.data?.version || 'Unknown',
            project: serverInfoResponse.data?.data?.project || 'Unknown'
          }
        };

      } catch (tokenError: any) {
        logStep('token_validation_failed', {
          error: tokenError.message,
          status: tokenError.response?.status,
          details: tokenError.response?.data
        });
        return {
          success: false,
          message: 'Invalid admin token or insufficient permissions',
          error: {
            message: tokenError.message,
            status: tokenError.response?.status,
            details: tokenError.response?.data,
            validationLog
          }
        };
      }

    } catch (error: any) {
      logStep('connection_test_failed', {
        error: error.message,
        status: error.response?.status,
        details: error.response?.data
      });
      return {
        success: false,
        message: `Failed to connect to server: ${error.message}`,
        error: {
          message: error.message,
          status: error.response?.status,
          details: error.response?.data,
          validationLog
        }
      };
    }
  } catch (error: any) {
    logStep('fatal_error', {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: `Token validation failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
        validationLog
      }
    };
  }
}

/**
 * Imports data from another Directus instance
 */
export async function importFromDirectus(
  sourceUrl: string,
  sourceToken: string,
  collectionName: string
): Promise<{
  success: boolean;
  message: string;
  importedItems?: any[];
  error?: any;
  importLog?: ImportLogEntry[];
}> {
  const importLog: ImportLogEntry[] = [];
  
  const logStep = (step: string, details: Record<string, unknown>) => {
    const logEntry: ImportLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      details,
    };
    importLog.push(logEntry);
    console.log(`[${step}]`, details);
  };

  try {
    logStep('import_start', {
      sourceUrl,
      collectionName,
      hasToken: !!sourceToken,
    });

    // Validate token first
    const tokenValidation = await validateDirectusToken(sourceUrl, sourceToken);
    if (!tokenValidation.success) {
      logStep('token_validation_failed', tokenValidation.error);
      return {
        success: false,
        message: 'Token validation failed',
        error: tokenValidation.error,
        importLog
      };
    }

    logStep('token_validation_success', { serverInfo: tokenValidation.serverInfo });

    // Fetch data from source server
    logStep('fetch_data_start', { collectionName });
    const sourceResponse = await axios.get(`${sourceUrl}/items/${collectionName}`, {
      headers: {
        Authorization: sourceToken,
      },
      params: {
        limit: -1, // Get all items
      },
      timeout: 30000,
    });

    const sourceItems = sourceResponse.data?.data || [];
    logStep('fetch_data_success', {
      itemCount: sourceItems.length,
      collectionName
    });

    if (sourceItems.length === 0) {
      logStep('collection_empty', { collectionName });
      return {
        success: true,
        message: `Collection '${collectionName}' is empty on the source server`,
        importedItems: [],
        importLog
      };
    }

    // Import items to current server
    logStep('import_items_start', {
      itemCount: sourceItems.length,
      collectionName
    });

    const importedItems: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of sourceItems) {
      try {
        // Remove system fields that shouldn't be imported
        const { id, date_created, date_updated, user_created, user_updated, ...cleanItem } = item;
        
        // Import the item
        const importResponse = await axios.post(`/items/${collectionName}`, cleanItem, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        importedItems.push({
          originalId: id,
          newId: importResponse.data?.data?.id,
          status: 'success',
          data: importResponse.data?.data
        });
        successCount++;

        logStep('item_imported', {
          originalId: id,
          newId: importResponse.data?.data?.id,
          collectionName
        });

      } catch (itemError: any) {
        errorCount++;
        importedItems.push({
          originalId: item.id,
          status: 'error',
          error: {
            message: itemError.message,
            status: itemError.response?.status,
            details: itemError.response?.data
          }
        });

        logStep('item_import_failed', {
          originalId: item.id,
          error: itemError.message,
          collectionName
        });
      }
    }

    logStep('import_complete', {
      totalItems: sourceItems.length,
      successCount,
      errorCount,
      collectionName
    });

    return {
      success: true,
      message: `Successfully imported ${successCount} items from ${collectionName} (${errorCount} failed)`,
      importedItems,
      importLog
    };

  } catch (error: any) {
    logStep('fatal_error', {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: `Import failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data
      },
      importLog
    };
  }
}

/**
 * Imports data from external API
 */
export async function importFromExternalApi(
  selectedDomain: string,
  adminToken: string,
  collectionName: string
): Promise<{
  success: boolean;
  message: string;
  importedItems?: any[];
  error?: any;
  importLog?: ImportLogEntry[];
}> {
  const importLog: ImportLogEntry[] = [];
  
  const logStep = (step: string, details: Record<string, unknown>) => {
    const logEntry: ImportLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      details,
    };
    importLog.push(logEntry);
    console.log(`[${step}]`, details);
  };

  try {
    logStep('api_import_start', {
      selectedDomain,
      collectionName,
      hasToken: !!adminToken,
    });

    // Validate token first
    const tokenValidation = await validateDirectusToken(selectedDomain, adminToken);
    if (!tokenValidation.success) {
      logStep('token_validation_failed', tokenValidation.error);
      return {
        success: false,
        message: 'Token validation failed',
        error: tokenValidation.error,
        importLog
      };
    }

    logStep('token_validation_success', { serverInfo: tokenValidation.serverInfo });

    // Fetch data from external API
    logStep('fetch_api_data_start', { collectionName });
    const apiResponse = await axios.get(`${selectedDomain}/items/${collectionName}`, {
      headers: {
        Authorization: adminToken,
      },
      params: {
        limit: -1, // Get all items
      },
      timeout: 30000,
    });

    const apiItems = apiResponse.data?.data || [];
    logStep('fetch_api_data_success', {
      itemCount: apiItems.length,
      collectionName
    });

    if (apiItems.length === 0) {
      logStep('api_collection_empty', { collectionName });
      return {
        success: true,
        message: `Collection '${collectionName}' is empty on the API server`,
        importedItems: [],
        importLog
      };
    }

    // Import items to current server
    logStep('import_api_items_start', {
      itemCount: apiItems.length,
      collectionName
    });

    const importedItems: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of apiItems) {
      try {
        // Remove system fields that shouldn't be imported
        const { id, date_created, date_updated, user_created, user_updated, ...cleanItem } = item;
        
        // Import the item
        const importResponse = await axios.post(`/items/${collectionName}`, cleanItem, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        importedItems.push({
          originalId: id,
          newId: importResponse.data?.data?.id,
          status: 'success',
          data: importResponse.data?.data
        });
        successCount++;

        logStep('api_item_imported', {
          originalId: id,
          newId: importResponse.data?.data?.id,
          collectionName
        });

      } catch (itemError: any) {
        errorCount++;
        importedItems.push({
          originalId: item.id,
          status: 'error',
          error: {
            message: itemError.message,
            status: itemError.response?.status,
            details: itemError.response?.data
          }
        });

        logStep('api_item_import_failed', {
          originalId: item.id,
          error: itemError.message,
          collectionName
        });
      }
    }

    logStep('api_import_complete', {
      totalItems: apiItems.length,
      successCount,
      errorCount,
      collectionName
    });

    return {
      success: true,
      message: `Successfully imported ${successCount} items from API for ${collectionName} (${errorCount} failed)`,
      importedItems,
      importLog
    };

  } catch (error: any) {
    logStep('api_fatal_error', {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: `API import failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data
      },
      importLog
    };
  }
}

/**
 * Analyzes import logs and provides detailed summary
 */
export function analyzeImportLog(importLog: ImportLogEntry[]) {
  const analysis = {
    steps: importLog.map(log => ({
      timestamp: log.timestamp,
      step: log.step,
      details: log.details
    })),
    summary: {
      totalSteps: importLog.length,
      stepsByType: importLog.reduce((acc, log) => {
        acc[log.step] = (acc[log.step] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      errors: importLog.filter(log => log.step.includes('error')),
      warnings: importLog.filter(log => log.step.includes('warning'))
    },
    keyMetrics: {
      startTime: importLog.find(log => log.step === 'import_start')?.timestamp,
      endTime: importLog.find(log => log.step === 'import_complete')?.timestamp,
      duration: null as string | null
    }
  };

  // Calculate duration if both start and end times exist
  if (analysis.keyMetrics.startTime && analysis.keyMetrics.endTime) {
    const start = new Date(analysis.keyMetrics.startTime);
    const end = new Date(analysis.keyMetrics.endTime);
    const durationMs = end.getTime() - start.getTime();
    analysis.keyMetrics.duration = `${durationMs}ms`;
  }

  return analysis;
} 