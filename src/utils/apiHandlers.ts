// Import extensions SDK for extension-specific functionality
import { useApi, useCollection, useItems } from "@directus/extensions-sdk";
import { createDirectus, readItems, rest, staticToken, authentication } from "@directus/sdk";

import type { ImportLogEntry } from "../types";

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
  languages_code: string;
  title: string | { value: string };
  body: string | { value: string } | null;
  [key: string]: any; // Allow additional fields
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
  id: number | string;
  title: string;
  status: "created" | "updated" | "error";
  fields?: Record<string, any>;
  files?: {
    image: string | null;
    audio: string | null;
    video: string | string[] | null;
    media: string[] | null;
  };
  translations?: Translation[];
  error?: string;
  log: Array<{
    timestamp: string;
    step: string;
    details: any;
  }>;
}

/**
 * Generates an admin token using username and password
 */
export async function generateAdminToken(
  selectedDomain: string,
  username: string,
  password: string,
): Promise<{
  success: boolean;
  message: string;
  token?: string;
  error?: any;
}> {
  try {
    console.log('Generating admin token for:', { domain: selectedDomain, username });

    const sourceDirectus = createDirectus(selectedDomain)
      .with(authentication())
      .with(rest());

    // Authenticate and get token
    const authResult = await sourceDirectus.login({
      email: username,
      password: password,
    });
    
    if (authResult.access_token) {
      console.log('Admin token generated successfully');
      return {
        success: true,
        message: 'Admin token generated successfully',
        token: authResult.access_token,
      };
    } else {
      return {
        success: false,
        message: 'No access token received from authentication',
        error: { authResult },
      };
    }
  } catch (error: any) {
    console.error('Admin token generation failed:', {
      error: error.message,
      status: error.response?.status,
      details: error.response?.data,
    });
    
    return {
      success: false,
      message: `Failed to generate admin token: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}

/**
 * Tests API access to multiple collections to diagnose permission issues
 */
export async function testMultipleCollections(
  selectedDomain: string,
  adminToken: string,
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; message: string; error?: any }>;
}> {
  const testCollections = ['news', 'client', 'invoice', 'page'];
  const results: Record<string, { success: boolean; message: string; error?: any }> = {};
  
  for (const collection of testCollections) {
    console.log(`Testing collection: ${collection}`);
    const result = await testCollectionAccess(selectedDomain, adminToken, collection);
    results[collection] = result;
    
    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successCount = Object.values(results).filter(r => r.success).length;
  
  return {
    success: successCount > 0,
    results
  };
}

/**
 * Tests API access to a specific collection
 */
export async function testCollectionAccess(
  selectedDomain: string,
  adminToken: string,
  collectionName: string,
): Promise<{
  success: boolean;
  message: string;
  error?: any;
}> {
  try {
    console.log('Testing collection access:', {
      domain: selectedDomain,
      collection: collectionName,
      hasToken: !!adminToken,
      tokenPrefix: adminToken.substring(0, 10) + '...'
    });

    const normalizedToken = adminToken.replace(/^Bearer\s+/i, "");
    const sourceDirectus = createDirectus(selectedDomain)
      .with(staticToken(normalizedToken))
      .with(rest());

    // Test with a simple query first
    console.log('Making API request to:', `${selectedDomain}/items/${collectionName}?limit=1`);
    
    // Try the Directus SDK method first
    try {
      const testResult = await sourceDirectus.request(
        (readItems as any)(collectionName, { limit: 1 }),
      );

      console.log('Collection access test successful (SDK method):', {
        collection: collectionName,
        resultType: typeof testResult,
        isArray: Array.isArray(testResult),
        length: Array.isArray(testResult) ? testResult.length : 'N/A'
      });

      return {
        success: true,
        message: `Successfully accessed collection '${collectionName}'`,
      };
    } catch (sdkError: any) {
      console.log('SDK method failed, trying alternative approach:', sdkError.message);
      
      // Try alternative approach - test if collection exists first
      try {
        const collectionsResult = await sourceDirectus.request(
          (readItems as any)("directus_collections", { limit: -1 })
        );
        
        const collectionExists = Array.isArray(collectionsResult) && collectionsResult.some((col: any) => col.collection === collectionName);
        
        if (!collectionExists) {
          return {
            success: false,
            message: `Collection '${collectionName}' does not exist on the server`,
            error: {
              message: 'Collection not found',
              status: 404,
            },
          };
        }
        
        // Collection exists, so the issue is likely permissions
        return {
          success: false,
          message: `Collection '${collectionName}' exists but you don't have permission to access it`,
          error: {
            message: sdkError.message,
            status: sdkError.response?.status || 403,
            details: sdkError.response?.data,
          },
        };
      } catch (collectionsError: any) {
        // If we can't even read collections, there's a broader permission issue
        return {
          success: false,
          message: `Cannot access collections list: ${collectionsError.message}`,
          error: {
            message: collectionsError.message,
            status: collectionsError.response?.status,
            details: collectionsError.response?.data,
          },
        };
      }
    }
  } catch (error: any) {
    console.error('Collection access test failed:', {
      collectionName,
      error: error.message,
      status: error.response?.status,
      details: error.response?.data,
      url: selectedDomain,
      fullError: error
    });
    
    return {
      success: false,
      message: `Failed to access collection '${collectionName}': ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}

/**
 * Validates a Directus admin token against a target server
 */
export async function validateDirectusToken(
  selectedDomain: string,
  adminToken: string,
  api?: any,
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
    logStep("request_received", {
      selectedDomain,
      hasToken: !!adminToken,
    });

    if (!selectedDomain || !adminToken) {
      const error = {
        hasSelectedDomain: !!selectedDomain,
        hasAdminToken: !!adminToken,
      };
      logStep("validation_error", error);
      return {
        success: false,
        message: "Missing required parameters: selectedDomain and adminToken",
        error: { validationLog },
      };
    }

    // Use the provided API instance or create a new one
    const normalizedToken = adminToken.replace(/^Bearer\s+/i, "");
    const directusApi =
      api || createDirectus(selectedDomain).with(staticToken(normalizedToken)).with(rest());

    // Test connection by trying to read collections
    logStep("token_validation_start", {});
    try {
      const collectionsResponse = (await directusApi.request((readItems as any)("directus_users", { limit: 1 }))) as any[];

      logStep("token_validation_success", {
        hasAccess: true,
        collectionCount: collectionsResponse?.length || 0,
      });

      return {
        success: true,
        message: "Token validation successful",
        serverInfo: undefined,
      };
    } catch (tokenError: any) {
      logStep("token_validation_failed", {
        error: tokenError.message,
        status: tokenError.response?.status,
        details: tokenError.response?.data,
      });
      return {
        success: false,
        message: "Invalid admin token or insufficient permissions",
        error: {
          message: tokenError.message,
          status: tokenError.response?.status,
          details: tokenError.response?.data,
          validationLog,
        },
      };
    }
  } catch (error: any) {
    logStep("fatal_error", {
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
        validationLog,
      },
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
  apiInstance?: any,
  limit?: number,
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
    logStep("import_start", {
      sourceUrl,
      collectionName,
      hasToken: !!sourceToken,
    });

    // Validate token first
    const tokenValidation = await validateDirectusToken(sourceUrl, sourceToken, apiInstance);
    if (!tokenValidation.success) {
      logStep("token_validation_failed", tokenValidation.error);
      return {
        success: false,
        message: "Token validation failed",
        error: tokenValidation.error,
        importLog,
      };
    }

    logStep("token_validation_success", { serverInfo: tokenValidation.serverInfo });

    // Create source Directus instance
    const normalizedSourceToken = sourceToken.replace(/^Bearer\s+/i, "");
    const sourceDirectus = createDirectus(sourceUrl).with(staticToken(normalizedSourceToken)).with(rest());

    // Ensure target folder exists (name: collectionName) and get its ID
    const targetFolderName = collectionName;
    let targetFolderId: string | null = null;
    try {
      const findFolderRes = await apiInstance.get('/folders', {
        params: {
          limit: 1,
          filter: { name: { _eq: targetFolderName } },
        },
      });
      const existingFolder = findFolderRes?.data?.data?.[0];
      if (existingFolder?.id) {
        targetFolderId = existingFolder.id;
      } else {
        const createFolderRes = await apiInstance.post('/folders', {
          name: targetFolderName,
          parent: null,
        });
        targetFolderId = createFolderRes?.data?.data?.id || null;
      }
      logStep('target_folder_ready', { name: targetFolderName, id: targetFolderId });
    } catch (folderErr: any) {
      logStep('target_folder_error', { name: targetFolderName, error: folderErr.message });
    }

    // Helper: mapping between source item id and local item id for idempotent updates
    const getMappedLocalId = async (syncId: string | number): Promise<string | null> => {
      try {
        const res = await apiInstance.get('/items/directus_sync_id_map', {
          params: {
            limit: 1,
            filter: {
              table: { _eq: collectionName },
              sync_id: { _eq: String(syncId) },
            },
          },
        });
        const hit = res?.data?.data?.[0];
        return hit?.local_id ? String(hit.local_id) : null;
      } catch (e) {
        return null;
      }
    };

    const upsertMapping = async (syncId: string | number, localId: string | number): Promise<void> => {
      try {
        const res = await apiInstance.get('/items/directus_sync_id_map', {
          params: {
            limit: 1,
            filter: {
              table: { _eq: collectionName },
              sync_id: { _eq: String(syncId) },
            },
          },
        });
        const existing = res?.data?.data?.[0];
        if (existing?.id) {
          if (existing.local_id !== String(localId)) {
            await apiInstance.patch(`/items/directus_sync_id_map/${existing.id}`, {
              local_id: String(localId),
            });
          }
        } else {
          await apiInstance.post('/items/directus_sync_id_map', {
            table: collectionName,
            sync_id: String(syncId),
            local_id: String(localId),
          });
        }
      } catch (e) {
        // Non-fatal mapping error
      }
    };

    // Fetch data from source server
    logStep("fetch_data_start", { collectionName });
    const fetchLimit = typeof limit === 'number' && limit > 0 ? limit : -1;
    const response = await sourceDirectus.request(
      (readItems as any)(collectionName, { limit: fetchLimit }),
    );
    
    // Ensure sourceItems is always an array
    const sourceItems = Array.isArray(response) ? response : [];

    logStep("fetch_data_success", {
      itemCount: sourceItems.length,
      collectionName,
    });

    if (sourceItems.length === 0) {
      logStep("collection_empty", { collectionName });
      return {
        success: true,
        message: `Collection '${collectionName}' is empty on the source server`,
        importedItems: [],
        importLog,
      };
    }

    // File helpers and copy with caching
    const fileIdCache = new Map<string, string>();
    const fetchSourceFileMeta = async (fileId: string): Promise<any> => {
      const metaRes = await fetch(`${sourceUrl}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${normalizedSourceToken}` },
      });
      if (!metaRes.ok) throw new Error(`Source file metadata not accessible (status ${metaRes.status})`);
      const metaJson = await metaRes.json();
      return metaJson?.data || {};
    };
    const fetchTargetFileMeta = async (fileId: string): Promise<any> => {
      const res = await apiInstance.get(`/files/${fileId}`);
      return res?.data?.data || {};
    };
    const sameFileMeta = (src: any, dst: any): boolean => {
      if (!src || !dst) return false;
      if (src.checksum && dst.checksum && src.checksum === dst.checksum) return true;
      if (typeof src.filesize === 'number' && typeof dst.filesize === 'number' && src.filesize === dst.filesize) {
        if (src.type && dst.type && src.type !== dst.type) return false;
        return true;
      }
      return false;
    };
    const copyFileToTarget = async (fileId: string, preferredTitle?: string | null): Promise<string> => {
      if (fileIdCache.has(fileId)) return fileIdCache.get(fileId)!;
      try {
        const fileMeta = await fetchSourceFileMeta(fileId);
        const binRes = await fetch(`${sourceUrl}/assets/${fileId}`, {
          headers: { Authorization: `Bearer ${normalizedSourceToken}` },
        });
        if (!binRes.ok) {
          throw new Error(`Source file binary not accessible (status ${binRes.status})`);
        }
        const blob = await binRes.blob();
        const filename = fileMeta.filename_download || fileMeta.filename || `${fileId}`;
        const formData = new FormData();
        formData.append('file', blob, filename);
        const finalTitle = (preferredTitle && String(preferredTitle).trim()) || (fileMeta.title && String(fileMeta.title).trim()) || '';
        if (finalTitle) formData.append('title', finalTitle);
        if (targetFolderId) {
          formData.append('folder', targetFolderId);
        }
        if (fileMeta.filename_download) formData.append('filename_download', fileMeta.filename_download);
        const uploadRes = await apiInstance.post('/files', formData);
        const newId = uploadRes?.data?.data?.id;
        if (!newId) throw new Error('Target upload did not return an ID');
        fileIdCache.set(fileId, String(newId));
        return String(newId);
      } catch (e: any) {
        throw new Error(`File copy failed for ${fileId}: ${e.message}`);
      }
    };

    // Import items to current server
    logStep("import_items_start", {
      itemCount: sourceItems.length,
      collectionName,
    });

    const importedItems: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    const itemsToImport =
      typeof limit === 'number' && limit > 0 ? sourceItems.slice(0, limit) : sourceItems;

    // Helper: derive a reasonable item title
    const deriveItemTitle = (raw: any): string | null => {
      if (raw && typeof raw.title === 'string' && raw.title.trim().length > 0) return raw.title.trim();
      const translations = raw?.translations;
      if (Array.isArray(translations)) {
        for (const tr of translations) {
          if (!tr) continue;
          const t = (typeof tr.title === 'string' ? tr.title : (tr.title && typeof tr.title === 'object' && typeof tr.title.value === 'string' ? tr.title.value : '')) as string;
          if (t && t.trim().length > 0) return t.trim();
        }
      }
      return null;
    };

    for (const item of itemsToImport) {
      try {
        // Remove system fields that shouldn't be imported
        const { id, date_created, date_updated, user_created, user_updated, ...cleanItem } = item;
        const itemTitle = deriveItemTitle(item);

        // Determine if item exists locally to enable file reuse check
        const mappedLocalId = await getMappedLocalId(id);
        let existingItemData: any | null = null;
        if (mappedLocalId) {
          try {
            const existingRes = await apiInstance.get(`/items/${collectionName}/${mappedLocalId}`);
            existingItemData = existingRes?.data?.data || null;
          } catch (e) {
            existingItemData = null;
          }
        }

        // Per-item caches to avoid handling the same source file multiple times across fields
        const perItemSourceToTargetFileId = new Map<string, string>();
        const perItemPatchedTargetFileIds = new Set<string>();
        const perItemSourceMetaCache = new Map<string, any>();

        // Detect and copy single-file fields from source to target
        for (const key of Object.keys(cleanItem)) {
          try {
            const value: any = (cleanItem as any)[key];
            if (!value) continue;
            // Skip arrays (multi-file relations often require junction payloads)
            if (Array.isArray(value)) {
              logStep('file_copy_skip', { reason: 'array_not_supported', field: key, itemId: id });
              continue;
            }
            // Determine candidate file id
            const candidateId = typeof value === 'string' ? value : (typeof value === 'object' && value.id ? value.id : null);
            if (!candidateId || typeof candidateId !== 'string') continue;

            // If we've already processed this source file in this item, reuse immediately
            if (perItemSourceToTargetFileId.has(candidateId)) {
              const reusedId = perItemSourceToTargetFileId.get(candidateId)!;
              (cleanItem as any)[key] = reusedId;
              logStep('file_reused_in_item', { field: key, sourceFileId: candidateId, reusedFileId: reusedId, itemId: id });
              continue;
            }

            // Probe if this id corresponds to a file on source
            const headRes = await fetch(`${sourceUrl}/files/${candidateId}`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${normalizedSourceToken}` },
            });
            if (!headRes.ok) continue; // Not a file; leave as is

            // If we already have an existing target item and it has a file on this field, compare and reuse/patch
            if (existingItemData) {
              const existingVal = (existingItemData as any)[key];
              const existingTargetFileId = typeof existingVal === 'string' ? existingVal : (existingVal && typeof existingVal === 'object' && existingVal.id ? existingVal.id : null);
              if (existingTargetFileId) {
                try {
                  const srcMeta = perItemSourceMetaCache.has(candidateId)
                    ? perItemSourceMetaCache.get(candidateId)
                    : await fetchSourceFileMeta(candidateId);
                  perItemSourceMetaCache.set(candidateId, srcMeta);
                  const dstMeta = await fetchTargetFileMeta(existingTargetFileId);
                  if (sameFileMeta(srcMeta, dstMeta)) {
                    const patch: any = {};
                    const desiredTitle = (itemTitle && itemTitle.trim()) || undefined;
                    if (desiredTitle && dstMeta.title !== desiredTitle) patch.title = desiredTitle;
                    if (targetFolderId && dstMeta.folder !== targetFolderId) patch.folder = targetFolderId;
                    if (Object.keys(patch).length > 0 && !perItemPatchedTargetFileIds.has(existingTargetFileId)) {
                      await apiInstance.patch(`/files/${existingTargetFileId}`, patch);
                      perItemPatchedTargetFileIds.add(existingTargetFileId);
                      logStep('file_reused_and_patched', { field: key, fileId: existingTargetFileId, itemId: id, patch });
                    } else {
                      logStep('file_reused', { field: key, fileId: existingTargetFileId, itemId: id });
                    }
                    (cleanItem as any)[key] = existingTargetFileId;
                    perItemSourceToTargetFileId.set(candidateId, existingTargetFileId);
                    continue; // Skip upload for this field
                  }
                } catch (cmpErr: any) {
                  // If comparison fails, fall through to copy
                }
              }
            }

            logStep('file_copy_start', { field: key, sourceFileId: candidateId, itemId: id, title: itemTitle || null });
            const newFileId = await copyFileToTarget(candidateId, itemTitle || undefined);
            (cleanItem as any)[key] = newFileId;
            logStep('file_copy_success', { field: key, sourceFileId: candidateId, newFileId, itemId: id, title: itemTitle || null });
            perItemSourceToTargetFileId.set(candidateId, newFileId);
          } catch (fileErr: any) {
            logStep('file_copy_error', { field: key, itemId: id, error: fileErr.message });
            // Proceed without changing the field
          }
        }

        // Create or update the item depending on existing mapping
        let importResponse: any | null = null;
        let action: 'created' | 'updated' = 'created';

        if (mappedLocalId) {
          logStep('item_update_start', { sourceId: id, localId: mappedLocalId, collectionName });
          try {
            importResponse = await apiInstance.patch(`/items/${collectionName}/${mappedLocalId}`, cleanItem);
            action = 'updated';
          } catch (updateErr: any) {
            // If update fails (e.g., 404), fallback to create
            logStep('item_update_failed_fallback_create', {
              sourceId: id,
              localId: mappedLocalId,
              error: updateErr?.message,
            });
            importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);
            action = 'created';
          }
        } else {
          importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);
          action = 'created';
        }

        importedItems.push({
          originalId: id,
          newId: importResponse.data?.data?.id,
          status: "success",
          action,
          data: importResponse.data?.data,
        });
        successCount++;

        logStep(action === 'updated' ? "item_updated" : "item_imported", {
          originalId: id,
          newId: importResponse.data?.data?.id,
          collectionName,
        });

        // Maintain sync id mapping
        await upsertMapping(id, importResponse.data?.data?.id);
      } catch (itemError: any) {
        errorCount++;
        importedItems.push({
          originalId: item.id,
          status: "error",
          error: {
            message: itemError.message,
            status: itemError.response?.status,
            details: itemError.response?.data,
          },
        });

        logStep("item_import_failed", {
          originalId: item.id,
          error: itemError.message,
          collectionName,
        });
      }
    }

    logStep("import_complete", {
      totalItems: sourceItems.length,
      successCount,
      errorCount,
      collectionName,
    });

    return {
      success: true,
      message: `Successfully imported ${successCount} items from ${collectionName} (${errorCount} failed)`,
      importedItems,
      importLog,
    };
  } catch (error: any) {
    logStep("fatal_error", {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: `Import failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
      importLog,
    };
  }
}

/**
 * Imports data from external API
 */

/**
 * Analyzes import logs and provides detailed summary
 */
export function analyzeImportLog(importLog: ImportLogEntry[]) {
  const analysis = {
    steps: importLog.map((log) => ({
      timestamp: log.timestamp,
      step: log.step,
      details: log.details,
    })),
    summary: {
      totalSteps: importLog.length,
      stepsByType: importLog.reduce(
        (acc, log) => {
          acc[log.step] = (acc[log.step] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      errors: importLog.filter((log) => log.step.includes("error")),
      warnings: importLog.filter((log) => log.step.includes("warning")),
    },
    keyMetrics: {
      startTime: importLog.find((log) => log.step === "import_start")?.timestamp,
      endTime: importLog.find((log) => log.step === "import_complete")?.timestamp,
      duration: null as string | null,
    },
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

/**
 * Gets collection data using useApi hook from extensions SDK
 * This function should be called from within a Vue component setup function
 */
export async function getCollectionDataWithUseApi(
  api: any,
  collectionName: string,
  options?: {
    limit?: number;
    filter?: any;
    sort?: string[];
    fields?: string[];
  },
): Promise<{
  success: boolean;
  data?: any[];
  error?: any;
  total?: number;
}> {
  try {
    const params: any = {};

    if (options?.limit) {
      params.limit = options.limit;
    }

    if (options?.filter) {
      params.filter = options.filter;
    }

    if (options?.sort) {
      params.sort = options.sort;
    }

    if (options?.fields) {
      params.fields = options.fields;
    }

    // Use the api instance (from useApi hook) to get collection data
    const response = await api.get(`/items/${collectionName}`, { params });

    return {
      success: true,
      data: response.data?.data || [],
      total: response.data?.meta?.filter_count || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}

/**
 * Gets all collections using useApi hook from extensions SDK
 * This function should be called from within a Vue component setup function
 */
export async function getAllCollectionsWithUseApi(
  api: any,
  excludePatterns?: string[],
): Promise<{
  success: boolean;
  collections?: any[];
  error?: any;
}> {
  try {
    const defaultExcludePatterns = [
      "_translations",
      "_languages",
      "_extensions",
      "_operations",
      "_shares",
      "_fields",
      "_migrations",
      "_versions",
      "_notifications",
      "_sessions",
      "_sync_id",
    ];

    const patternsToExclude = excludePatterns || defaultExcludePatterns;

    // Use the api instance (from useApi hook) to get all collections
    const response = await api.get("/collections");

    const allCollections = response.data?.data || [];

    // Filter out system collections and folders
    const filteredCollections = allCollections.filter((collection: any) => {
      const isExcluded = patternsToExclude.some((pattern: string) =>
        collection.collection.includes(pattern),
      );
      const isFolder = collection.meta?.is_folder;
      return !isExcluded && !isFolder;
    });

    return {
      success: true,
      collections: filteredCollections,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}
