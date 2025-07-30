import type { ImportLogEntry } from '../types';
import {
  createDirectus,
  createFolder,
  createItems,
  deleteFiles,
  deleteItems,
  readFiles,
  readFolders,
  readItems,
  rest,
  staticToken,
  updateItem,
  uploadFiles,
  updateFile,
  readCollection,
  readFields,
} from '@directus/sdk';

// Simplified browser-compatible version without axios and crypto dependencies

// Add interfaces for the import functionality
interface TitleObject {
  name: string;
  type: string;
  label: string;
  required: number;
  minlength: number;
  maxlength: number;
  size: number;
  tags: string;
  id: number;
  field_languageId: number;
  value: string;
}

interface BodyObject {
  name: string;
  type: string;
  label: string;
  minlength: number;
  maxlength: number;
  tags: string;
  id: number;
  field_languageId: number;
  value: string;
}

interface Translation {
  languages_code: string
  title: string | { value: string }
  body: string | { value: string } | null
  [key: string]: any // Allow additional fields
}

interface BaseItem {
  id: number | string;
  title: string;
  status: number | string;
  date?: string;
  date_created?: string;
  counter?: number;
  url?: string;
  path?: string;
  sort?: number;
  client?: any;
  site?: any;
  services?: any;
  body?: any;
  image?: string | null;
  audio?: string | null;
  video?: string | string[] | null;
  videoFiles?: (string | { id: string })[];
  media?: Array<{
    url: string;
    filename: string;
    type: string;
    type_short: string;
    id: number;
    description: string;
    field_name: string;
  }>;
  translations?: Translation[];
}

interface ExistingItem extends BaseItem {
  id: number | string;
  status: string;
}

interface ApiError extends Error {
  response?: {
    data: unknown;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
  retries: number;
  details?: unknown;
}

interface ImportedItem {
  id: number | string
  title: string
  status: 'created' | 'updated' | 'error'
  fields?: Record<string, any>
  files?: {
    image: string | null
    audio: string | null
    video: string | string[] | null
    media: string[] | null
  }
  translations?: Translation[]
  error?: string
  log: Array<{
    timestamp: string
    step: string
    details: any
  }>
}

/**
 * Validates a Directus admin token against a target server
 */
export async function validateDirectusToken(
  selectedDomain: string,
  adminToken: string,
  api?: any
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

    // Use the provided API instance or create a new one
    const directusApi = api || createDirectus(selectedDomain).with(staticToken(adminToken)).with(rest());

    // Test connection by trying to read collections
    logStep('token_validation_start', {});
    try {
      const collectionsResponse = await directusApi.request(readCollection('directus_collections')) as any[];
      
      logStep('token_validation_success', {
        hasAccess: true,
        collectionCount: collectionsResponse?.length || 0
      });

      // Get server info
      const serverInfoResponse = await directusApi.request(readCollection('directus_system_info')) as any;

      return {
        success: true,
        message: 'Token validation successful',
        serverInfo: {
          version: serverInfoResponse?.version || 'Unknown',
          project: serverInfoResponse?.project || 'Unknown'
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
  collectionName: string,
  apiInstance?: any
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
    const tokenValidation = await validateDirectusToken(sourceUrl, sourceToken, apiInstance);
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

    // Create source Directus instance
    const sourceDirectus = createDirectus(sourceUrl).with(staticToken(sourceToken)).with(rest());

    // Fetch data from source server
    logStep('fetch_data_start', { collectionName });
    const sourceItems = await sourceDirectus.request(
      (readItems as any)(collectionName, { limit: -1 })
    ) as any[];

    logStep('fetch_data_success', {
      itemCount: sourceItems?.length || 0,
      collectionName
    });

    if (!sourceItems || sourceItems.length === 0) {
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
        
        // Import the item using the API instance
        const importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);

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
  collectionName: string,
  apiInstance?: any
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
    const tokenValidation = await validateDirectusToken(selectedDomain, adminToken, apiInstance);
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

    // Create source Directus instance
    const sourceDirectus = createDirectus(selectedDomain).with(staticToken(adminToken)).with(rest());

    // Fetch data from external API
    logStep('fetch_api_data_start', { collectionName });
    const apiItems = await sourceDirectus.request(
      (readItems as any)(collectionName, { limit: -1 })
    ) as any[];

    logStep('fetch_api_data_success', {
      itemCount: apiItems?.length || 0,
      collectionName
    });

    if (!apiItems || apiItems.length === 0) {
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
        
        // Import the item using the API instance
        const importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);

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
 * Simplified import collection handler for browser compatibility
 */
export async function importCollectionHandler(
  directus: any,
  collection: string,
  selectedDomain: string,
  req?: any
): Promise<{
  success: boolean;
  message: string;
  summary?: any;
  importedData?: any;
  processedItems?: ImportedItem[];
  importLog?: any[];
  error?: any;
}> {
  const importLog: any[] = []
  const logStep = (step: string, details: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      step,
      details,
    }
    importLog.push(logEntry)
    console.log(`[${step}]`, details)
  }

  try {
    logStep('request_received', {
      selectedDomain,
      collection
    })

    if (!selectedDomain) {
      return {
        success: false,
        message: 'Missing required parameter: selectedDomain',
        error: { importLog }
      }
    }

    // Create source Directus instance
    const sourceDirectus = createDirectus(selectedDomain).with(rest());

    // Fetch data from API
    logStep('api_request_start', { url: selectedDomain })
    const items = await sourceDirectus.request(
      (readItems as any)(collection, { limit: -1 })
    ) as any[]

    logStep('api_request_complete', {
      itemCount: items?.length || 0,
      collection
    })

    if (!items || items.length === 0) {
      return {
        success: true,
        message: `Collection '${collection}' is empty`,
        summary: { totalItems: 0 },
        importedData: { items: [] },
        processedItems: [],
        importLog
      }
    }

    // Get existing items
    const existingItems = await directus.request(
      (readItems as any)(collection, {
        filter: {
          id: {
            _in: items
              .map((item: any) => (typeof item.id === 'number' && !isNaN(item.id) ? item.id : null))
              .filter((id: any): id is number => id !== null),
          },
        },
      })
    )

    const importedItems: ImportedItem[] = []

    // Process each item
    for (const item of items) {
      try {
        const existingItem = existingItems.find((e: any) => e.id === item.id);

        if (existingItem) {
          // Update existing item
          const { id, date_created, date_updated, user_created, user_updated, ...cleanItem } = item;
          await directus.request(
            (updateItem as any)(collection, existingItem.id, cleanItem)
          );

          importedItems.push({
            id: item.id,
            title: item.title || 'Unknown',
            status: 'updated',
            log: []
          });
        } else {
          // Create new item
          const { id, date_created, date_updated, user_created, user_updated, ...cleanItem } = item;
          const result = await directus.request(
            (createItems as any)(collection, [cleanItem])
          );

          importedItems.push({
            id: item.id,
            title: item.title || 'Unknown',
            status: 'created',
            log: []
          });
        }
      } catch (error: any) {
        importedItems.push({
          id: item.id,
          title: item.title || 'Unknown',
          status: 'error',
          error: error.message,
          log: []
        });
      }
    }

    const successfulItems = importedItems.filter(item => item.status === 'created' || item.status === 'updated');
    const failedItems = importedItems.filter(item => item.status === 'error');

    return {
      success: true,
      message: `Imported ${importedItems.length} items from ${collection}`,
      summary: {
        totalItems: items.length,
        successful: successfulItems.length,
        failed: failedItems.length,
        created: importedItems.filter(item => item.status === 'created').length,
        updated: importedItems.filter(item => item.status === 'updated').length,
        collection,
        sourceUrl: selectedDomain
      },
      importedData: {
        items: importedItems.map(item => ({
          id: item.id,
          title: item.title,
          status: item.status,
          error: item.error
        }))
      },
      processedItems: importedItems,
      importLog,
    };

  } catch (error: any) {
    logStep('fatal_error', {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: `Error importing collections: ${error.message}`,
      error: {
        message: error.message,
        details: error.response?.data || 'No additional details available',
      },
      importLog,
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