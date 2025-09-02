// Import extensions SDK for extension-specific functionality
import { useApi, useCollection, useItems } from "@directus/extensions-sdk";
import { authentication, createDirectus, readItems, rest, staticToken } from "@directus/sdk";

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
    console.log("Generating admin token for:", { domain: selectedDomain, username });

    const sourceDirectus = createDirectus(selectedDomain).with(authentication()).with(rest());

    // Authenticate and get token
    const authResult = await sourceDirectus.login({
      email: username,
      password: password,
    });

    if (authResult.access_token) {
      console.log("Admin token generated successfully");
      return {
        success: true,
        message: "Admin token generated successfully",
        token: authResult.access_token,
      };
    } else {
      return {
        success: false,
        message: "No access token received from authentication",
        error: { authResult },
      };
    }
  } catch (error: any) {
    console.error("Admin token generation failed:", {
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
  const testCollections = ["news", "client", "invoice", "page"];
  const results: Record<string, { success: boolean; message: string; error?: any }> = {};

  for (const collection of testCollections) {
    console.log(`Testing collection: ${collection}`);
    const result = await testCollectionAccess(selectedDomain, adminToken, collection);
    results[collection] = result;

    // Add a small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successCount = Object.values(results).filter((r) => r.success).length;

  return {
    success: successCount > 0,
    results,
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
    console.log("Testing collection access:", {
      domain: selectedDomain,
      collection: collectionName,
      hasToken: !!adminToken,
      tokenPrefix: adminToken.substring(0, 10) + "...",
    });

    const normalizedToken = adminToken.replace(/^Bearer\s+/i, "");
    const sourceDirectus = createDirectus(selectedDomain)
      .with(staticToken(normalizedToken))
      .with(rest());

    // Test with a simple query first
    console.log("Making API request to:", `${selectedDomain}/items/${collectionName}?limit=1`);

    // Try the Directus SDK method first
    try {
      const testResult = await sourceDirectus.request(
        (readItems as any)(collectionName, { limit: 1 }),
      );

      console.log("Collection access test successful (SDK method):", {
        collection: collectionName,
        resultType: typeof testResult,
        isArray: Array.isArray(testResult),
        length: Array.isArray(testResult) ? testResult.length : "N/A",
      });

      return {
        success: true,
        message: `Successfully accessed collection '${collectionName}'`,
      };
    } catch (sdkError: any) {
      console.log("SDK method failed, trying alternative approach:", sdkError.message);

      // Try alternative approach - test if collection exists first
      try {
        const collectionsResult = await sourceDirectus.request(
          (readItems as any)("directus_collections", { limit: -1 }),
        );

        const collectionExists =
          Array.isArray(collectionsResult) &&
          collectionsResult.some((col: any) => col.collection === collectionName);

        if (!collectionExists) {
          return {
            success: false,
            message: `Collection '${collectionName}' does not exist on the server`,
            error: {
              message: "Collection not found",
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
    console.error("Collection access test failed:", {
      collectionName,
      error: error.message,
      status: error.response?.status,
      details: error.response?.data,
      url: selectedDomain,
      fullError: error,
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
      const collectionsResponse = (await directusApi.request(
        (readItems as any)("directus_users", { limit: 1 }),
      )) as any[];

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
  titleFilter?: string,
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
    const sourceDirectus = createDirectus(sourceUrl)
      .with(staticToken(normalizedSourceToken))
      .with(rest());

    // Ensure target folder exists (name: collectionName) and get its ID
    const targetFolderName = collectionName;
    let targetFolderId: string | null = null;
    try {
      const findFolderRes = await apiInstance.get("/folders", {
        params: {
          limit: 1,
          filter: { name: { _eq: targetFolderName } },
        },
      });
      const existingFolder = findFolderRes?.data?.data?.[0];
      if (existingFolder?.id) {
        targetFolderId = existingFolder.id;
      } else {
        const createFolderRes = await apiInstance.post("/folders", {
          name: targetFolderName,
          parent: null,
        });
        targetFolderId = createFolderRes?.data?.data?.id || null;
      }
      logStep("target_folder_ready", { name: targetFolderName, id: targetFolderId });
    } catch (folderErr: any) {
      logStep("target_folder_error", { name: targetFolderName, error: folderErr.message });
    }

    // Helper: mapping between source item id and local item id for idempotent updates
    const getMappedLocalId = async (syncId: string | number): Promise<string | null> => {
      try {
        const res = await apiInstance.get("/items/directus_sync_id_map", {
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

    const upsertMapping = async (
      syncId: string | number,
      localId: string | number,
    ): Promise<void> => {
      try {
        const res = await apiInstance.get("/items/directus_sync_id_map", {
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
          await apiInstance.post("/items/directus_sync_id_map", {
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
    logStep("fetch_data_start", { collectionName, titleFilter });
    const fetchLimit = typeof limit === "number" && limit > 0 ? limit : -1;
    
    // Build query parameters
    const queryParams: any = { limit: fetchLimit };
    
    if (titleFilter && titleFilter.trim()) {
      // Filter only by translations title since the main collection doesn't have a title field
      queryParams.filter = {
        translations: {
          title: {
            _contains: titleFilter.trim()
          }
        }
      };
      logStep("title_filter_applied", { 
        filter: titleFilter.trim(), 
        approach: "translations.title only" 
      });
    }
    
    const response = await sourceDirectus.request(
      (readItems as any)(collectionName, queryParams),
    );

    // Ensure sourceItems is always an array
    const sourceItems = Array.isArray(response) ? response : [];

    logStep("fetch_data_success", {
      itemCount: sourceItems.length,
      collectionName,
    });

    if (sourceItems.length === 0) {
      logStep("collection_empty", { collectionName, titleFilter });
      const filterMessage = titleFilter && titleFilter.trim() ? ` with title filter '${titleFilter.trim()}'` : '';
      return {
        success: true,
        message: `Collection '${collectionName}'${filterMessage} is empty on the source server`,
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
      if (!metaRes.ok)
        throw new Error(`Source file metadata not accessible (status ${metaRes.status})`);
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
      if (
        typeof src.filesize === "number" &&
        typeof dst.filesize === "number" &&
        src.filesize === dst.filesize
      ) {
        if (src.type && dst.type && src.type !== dst.type) return false;
        return true;
      }
      return false;
    };
    const copyFileToTarget = async (
      fileId: string,
      preferredTitle?: string | null,
    ): Promise<string> => {
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
        formData.append("file", blob, filename);
        const finalTitle =
          (preferredTitle && String(preferredTitle).trim()) ||
          (fileMeta.title && String(fileMeta.title).trim()) ||
          "";
        if (finalTitle) formData.append("title", finalTitle);
        if (targetFolderId) {
          formData.append("folder", targetFolderId);
        }
        if (fileMeta.filename_download)
          formData.append("filename_download", fileMeta.filename_download);
        const uploadRes = await apiInstance.post("/files", formData);
        const newId = uploadRes?.data?.data?.id;
        if (!newId) throw new Error("Target upload did not return an ID");
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
      typeof limit === "number" && limit > 0 ? sourceItems.slice(0, limit) : sourceItems;

    // Helper: derive a reasonable item title
    const deriveItemTitle = (raw: any): string | null => {
      if (raw && typeof raw.title === "string" && raw.title.trim().length > 0)
        return raw.title.trim();
      const translations = raw?.translations;
      if (Array.isArray(translations)) {
        for (const tr of translations) {
          if (!tr) continue;
          const t = (
            typeof tr.title === "string"
              ? tr.title
              : tr.title && typeof tr.title === "object" && typeof tr.title.value === "string"
                ? tr.title.value
                : ""
          ) as string;
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
              logStep("file_copy_skip", { reason: "array_not_supported", field: key, itemId: id });
              continue;
            }
            // Determine candidate file id
            const candidateId =
              typeof value === "string"
                ? value
                : typeof value === "object" && value.id
                  ? value.id
                  : null;
            if (!candidateId || typeof candidateId !== "string") continue;

            // If we've already processed this source file in this item, reuse immediately
            if (perItemSourceToTargetFileId.has(candidateId)) {
              const reusedId = perItemSourceToTargetFileId.get(candidateId)!;
              (cleanItem as any)[key] = reusedId;
              logStep("file_reused_in_item", {
                field: key,
                sourceFileId: candidateId,
                reusedFileId: reusedId,
                itemId: id,
              });
              continue;
            }

            // Probe if this id corresponds to a file on source
            const headRes = await fetch(`${sourceUrl}/files/${candidateId}`, {
              method: "GET",
              headers: { Authorization: `Bearer ${normalizedSourceToken}` },
            });
            if (!headRes.ok) continue; // Not a file; leave as is

            // If we already have an existing target item and it has a file on this field, compare and reuse/patch
            if (existingItemData) {
              const existingVal = (existingItemData as any)[key];
              const existingTargetFileId =
                typeof existingVal === "string"
                  ? existingVal
                  : existingVal && typeof existingVal === "object" && existingVal.id
                    ? existingVal.id
                    : null;
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
                    if (targetFolderId && dstMeta.folder !== targetFolderId)
                      patch.folder = targetFolderId;
                    if (
                      Object.keys(patch).length > 0 &&
                      !perItemPatchedTargetFileIds.has(existingTargetFileId)
                    ) {
                      await apiInstance.patch(`/files/${existingTargetFileId}`, patch);
                      perItemPatchedTargetFileIds.add(existingTargetFileId);
                      logStep("file_reused_and_patched", {
                        field: key,
                        fileId: existingTargetFileId,
                        itemId: id,
                        patch,
                      });
                    } else {
                      logStep("file_reused", {
                        field: key,
                        fileId: existingTargetFileId,
                        itemId: id,
                      });
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

            logStep("file_copy_start", {
              field: key,
              sourceFileId: candidateId,
              itemId: id,
              title: itemTitle || null,
            });
            const newFileId = await copyFileToTarget(candidateId, itemTitle || undefined);
            (cleanItem as any)[key] = newFileId;
            logStep("file_copy_success", {
              field: key,
              sourceFileId: candidateId,
              newFileId,
              itemId: id,
              title: itemTitle || null,
            });
            perItemSourceToTargetFileId.set(candidateId, newFileId);
          } catch (fileErr: any) {
            logStep("file_copy_error", { field: key, itemId: id, error: fileErr.message });
            // Proceed without changing the field
          }
        }

        // Create or update the item depending on existing mapping
        let importResponse: any | null = null;
        let action: "created" | "updated" = "created";

        if (mappedLocalId) {
          logStep("item_update_start", { sourceId: id, localId: mappedLocalId, collectionName });
          try {
            importResponse = await apiInstance.patch(
              `/items/${collectionName}/${mappedLocalId}`,
              cleanItem,
            );
            action = "updated";
          } catch (updateErr: any) {
            // If update fails (e.g., 404), fallback to create
            logStep("item_update_failed_fallback_create", {
              sourceId: id,
              localId: mappedLocalId,
              error: updateErr?.message,
            });
            importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);
            action = "created";
          }
        } else {
          importResponse = await apiInstance.post(`/items/${collectionName}`, cleanItem);
          action = "created";
        }

        importedItems.push({
          originalId: id,
          newId: importResponse.data?.data?.id,
          status: "success",
          action,
          data: importResponse.data?.data,
        });
        successCount++;

        logStep(action === "updated" ? "item_updated" : "item_imported", {
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
      titleFilter,
    });

    const filterMessage = titleFilter && titleFilter.trim() ? ` (filtered by title: '${titleFilter.trim()}')` : '';
    return {
      success: true,
      message: `Successfully imported ${successCount} items from ${collectionName}${filterMessage} (${errorCount} failed)`,
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

/**
 * Export a collection from the current Directus instance into a ZIP file that
 * contains items.json and a files/ directory with all referenced files.
 */
export async function exportCollectionAsZip(
  api: any,
  collectionName: string,
  options?: {
    limit?: number;
    filter?: any;
    fields?: string[];
    includeDraft?: boolean;
  },
): Promise<{
  success: boolean;
  message: string;
  blob?: Blob;
  filename?: string;
  error?: any;
  stats?: { itemCount: number; fileCount: number };
}> {
  try {
    const { default: JSZipLib } = await import('jszip');
    const JSZip: any = JSZipLib || (await import('jszip')).default;
    const params: any = { limit: options?.limit ?? -1 };
    if (options?.filter) params.filter = options.filter;
    // Ensure translations are included by default unless caller explicitly provided fields
    if (options?.fields && options.fields.length > 0) {
      params.fields = options.fields;
      // If caller included fields but omitted translations, append them minimally
      if (!options.fields.some((f) => f === 'translations' || f.startsWith('translations.'))) {
        params.fields = [...options.fields, 'translations.*'];
      }
    } else {
      params.fields = ['*', 'translations.*'];
    }
    if (options?.includeDraft === false) params.filter = { ...(params.filter || {}), status: { _neq: "draft" } };

    const itemsRes = await api.get(`/items/${collectionName}`, { params });
    const items: any[] = itemsRes?.data?.data || [];

    const zip = new JSZip();
    const filesFolder = zip.folder("files");
    const addedFileIds = new Set<string>();

    // Helper: safe filename
    const toSafe = (name: string): string => name.replace(/[^a-zA-Z0-9._-]+/g, "_");

    // Probe if an id is an existing file in current instance
    const isExistingFile = async (id: string): Promise<null | { meta: any; filename: string }> => {
      try {
        const metaRes = await api.get(`/files/${id}`);
        const meta = metaRes?.data?.data;
        if (!meta?.id) return null;
        const filename = meta.filename_download || meta.filename || `${id}`;
        return { meta, filename };
      } catch {
        return null;
      }
    };

    // Collect candidate file ids from value
    const extractIds = (value: any): string[] => {
      if (!value) return [];
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) {
        const ids: string[] = [];
        for (const v of value) ids.push(...extractIds(v));
        return ids;
      }
      if (typeof value === "object" && value.id && typeof value.id === "string") return [value.id];
      return [];
    };

    // For each item, detect file fields and add binaries to zip (using authenticated API to avoid 403s)
    for (const item of items) {
      for (const [key, val] of Object.entries(item)) {
        const candidateIds = extractIds(val);
        for (const candidateId of candidateIds) {
          if (addedFileIds.has(candidateId)) continue;
          const probe = await isExistingFile(candidateId);
          if (!probe) continue;
          try {
            const binRes = await api.get(`/assets/${candidateId}`, { responseType: 'blob' });
            const blob: Blob = binRes?.data as Blob;
            const safeName = toSafe(`${candidateId}_${probe.filename}`);
            filesFolder?.file(safeName, blob);
            addedFileIds.add(candidateId);
          } catch (fileErr: any) {
            console.error("Failed to fetch file asset:", candidateId, fileErr?.message);
          }
        }
      }
    }

    // items.json contains raw items as-is, keeping file relations by id
    zip.file("items.json", JSON.stringify({ collection: collectionName, items }, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const filename = `${collectionName}-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

    return {
      success: true,
      message: "Export ZIP generated",
      blob,
      filename,
      stats: { itemCount: items.length, fileCount: addedFileIds.size },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Export failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}

/**
 * Convenience: generate and trigger download of the ZIP in browser
 */
export async function downloadCollectionZip(
  api: any,
  collectionName: string,
  options?: { limit?: number; filter?: any; fields?: string[]; includeDraft?: boolean },
): Promise<{
  success: boolean;
  message: string;
  stats?: { itemCount: number; fileCount: number };
  error?: any;
}> {
  const res = await exportCollectionAsZip(api, collectionName, options);
  if (res.success && res.blob && res.filename) {
    try {
      const mod = await import('file-saver');
      const saveAs = (mod as any).saveAs || (mod as any).default || (mod as any);
      saveAs(res.blob, res.filename);
      return { success: true, message: res.message, stats: res.stats };
    } catch (err: any) {
      return { success: false, message: `Download failed: ${err.message}`, error: err };
    }
  }
  return { success: false, message: res.message, error: res.error };
}

/**
 * Imports a collection from a previously exported ZIP (items.json + files/*)
 */
export async function importCollectionFromZip(
  api: any,
  collectionName: string,
  zipFile: File | Blob,
): Promise<{
  success: boolean;
  message: string;
  stats?: { created: number; updated: number; failed: number; filesUploaded: number };
  error?: any;
}> {
  try {
    const { default: JSZipLib } = await import('jszip');
    const JSZip: any = JSZipLib || (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipFile);

    // Read items.json
    const itemsEntry = zip.file('items.json');
    if (!itemsEntry) {
      return { success: false, message: 'items.json not found in ZIP' };
    }
    const itemsJson = await itemsEntry.async('string');
    const parsed = JSON.parse(itemsJson || '{}');
    const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];

    // Prepare/ensure target folder for imported files
    const targetFolderName = collectionName;
    let targetFolderId: string | null = null;
    try {
      const findFolderRes = await api.get('/folders', { params: { limit: 1, filter: { name: { _eq: targetFolderName } } } });
      const existingFolder = findFolderRes?.data?.data?.[0];
      if (existingFolder?.id) {
        targetFolderId = existingFolder.id;
      } else {
        const createFolderRes = await api.post('/folders', { name: targetFolderName, parent: null });
        targetFolderId = createFolderRes?.data?.data?.id || null;
      }
    } catch {}

    // Collect files
    const filesFolder = zip.folder('files');
    const fileIdToNewId = new Map<string, string>();
    let filesUploaded = 0;
    const zipFileByOriginalId = new Map<string, any>();

    // Minimal mime inference from filename extension for proper file typing in Directus
    const inferMimeType = (filename: string): string | undefined => {
      const ext = (filename.split('.')?.pop() || '').toLowerCase();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'svg':
          return 'image/svg+xml';
        case 'bmp':
          return 'image/bmp';
        case 'tif':
        case 'tiff':
          return 'image/tiff';
        case 'mp4':
          return 'video/mp4';
        case 'mov':
          return 'video/quicktime';
        case 'webm':
          return 'video/webm';
        case 'mp3':
          return 'audio/mpeg';
        case 'wav':
          return 'audio/wav';
        case 'ogg':
          return 'audio/ogg';
        case 'pdf':
          return 'application/pdf';
        default:
          return undefined;
      }
    };

    if (filesFolder) {
      const entries = Object.values(filesFolder.files)
        .filter((f: any) => !f.dir)
        // Never import JSON control files like items.json as assets
        .filter((f: any) => {
          const base = (f.name.split('/')?.pop() || '').toLowerCase();
          return base !== 'items.json' && !base.endsWith('.json');
        });
      for (const entry of entries as any[]) {
        const name: string = entry.name.split('/').pop() || '';
        // Expect pattern originalId_filename.ext (sanitized)
        const originalId = String(name.split('_')[0]);
        zipFileByOriginalId.set(originalId, entry);
        const blob = await entry.async('blob');
        const mime = inferMimeType(name);
        const filePart: Blob = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
        const formData = new FormData();
        formData.append('file', filePart, name);
        if (targetFolderId) formData.append('folder', targetFolderId);
        // Optional: try to preserve title and filename_download
        try {
          const res = await api.post('/files', formData);
          const newId = res?.data?.data?.id;
          if (newId) {
            fileIdToNewId.set(originalId, String(newId));
            filesUploaded++;
          }
        } catch (e: any) {
          console.error('File upload failed for', name, e?.message);
        }
      }
    }

    // Helper to remap file ids inside an arbitrary value
    const remapFileIds = (value: any): any => {
      if (!value) return value;
      if (typeof value === 'string') {
        return fileIdToNewId.get(value) || value;
      }
      if (Array.isArray(value)) {
        return value.map((v) => remapFileIds(v));
      }
      if (typeof value === 'object') {
        if (value.id && typeof value.id === 'string' && fileIdToNewId.has(value.id)) {
          return { ...value, id: fileIdToNewId.get(value.id) };
        }
        const out: any = Array.isArray(value) ? [] : { ...value };
        for (const [k, v] of Object.entries(value)) {
          (out as any)[k] = remapFileIds(v);
        }
        return out;
      }
      return value;
    };

    let created = 0;
    let updated = 0;
    let failed = 0;
    let firstErrorMessage: string | null = null;

    // Fetch field definitions for sanitization
    const fieldsRes = await api.get(`/fields/${collectionName}`, { params: { limit: -1 } });
    const fields = (fieldsRes?.data?.data || fieldsRes?.data || []) as Array<any>;
    const fieldByName = new Map<string, any>();
    for (const f of fields) fieldByName.set(f.field, f);
    const allowedFieldNames = new Set<string>(fields.map((f: any) => f.field));
    const hasStatus = allowedFieldNames.has('status');

    const isSimpleValue = (v: any): boolean => {
      if (v === null) return true;
      const t = typeof v;
      return t === 'string' || t === 'number' || t === 'boolean';
    };

    const toIdIfObject = (v: any): any => {
      if (!v) return v;
      if (typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string') return v.id;
      return v;
    };

    const sanitizePayload = (raw: any): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const key of Object.keys(raw || {})) {
        if (!allowedFieldNames.has(key)) continue;
        const value = raw[key];
        const fieldMeta = fieldByName.get(key) || {};
        const specials: string[] = Array.isArray(fieldMeta?.meta?.special) ? fieldMeta.meta.special : [];
        const related = fieldMeta?.meta?.related_collection || fieldMeta?.related_collection;
        const isFileField = specials.includes('file') || related === 'directus_files';
        // Keep only primitive values or single file references (object with id or string)
        if (isSimpleValue(value)) {
          result[key] = value;
          continue;
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          const idOrVal = toIdIfObject(value);
          if (isFileField) {
            // Force to string id for file fields, drop otherwise
            const candidate = typeof idOrVal === 'string' ? idOrVal : undefined;
            if (candidate) result[key] = candidate;
          } else if (isSimpleValue(idOrVal) || typeof idOrVal === 'string') {
            result[key] = idOrVal;
          }
          continue;
        }
        // Skip arrays and complex objects; relations should be handled separately later
      }
      if (hasStatus && (result.status === undefined || result.status === null || result.status === '')) {
        result.status = 'published';
      }
      return result;
    };

    const fillRequiredDefaults = async (payload: Record<string, any>): Promise<Record<string, any>> => {
      const out: Record<string, any> = { ...payload };
      for (const f of fields) {
        const name = f.field;
        const isRequired = Boolean(f?.meta?.required || f?.schema?.is_nullable === false);
        if (!isRequired) continue;
        const hasValue = out[name] !== undefined && out[name] !== null && out[name] !== '';
        if (hasValue) continue;
        const defVal = f?.schema?.default_value ?? f?.meta?.default_value;
        if (defVal !== undefined) {
          out[name] = defVal;
          continue;
        }
        const related = f?.meta?.related_collection || f?.related_collection;
        const specials: string[] = Array.isArray(f?.meta?.special) ? f.meta.special : [];
        const isO2OorO2M = related && !Array.isArray(out[name]) && !specials.includes('m2m');
        if (isO2OorO2M && !out[name]) {
          try {
            const relRes = await api.get(`/items/${related}`, { params: { fields: ['id'], limit: 1 } });
            const first = relRes?.data?.data?.[0];
            if (first?.id) out[name] = String(first.id);
          } catch {}
        }
      }
      return out;
    };

    const tryFindExistingId = async (payload: any): Promise<string | null> => {
      // Heuristics: url, path, slug, title (as last resort)
      const candidates: Array<[string, any]> = [];
      if (typeof payload.url === 'string' && payload.url.trim()) candidates.push(['url', payload.url.trim()]);
      if (typeof payload.path === 'string' && payload.path.trim()) candidates.push(['path', payload.path.trim()]);
      if (typeof payload.slug === 'string' && payload.slug.trim()) candidates.push(['slug', payload.slug.trim()]);
      if (typeof payload.title === 'string' && payload.title.trim()) candidates.push(['title', payload.title.trim()]);
      for (const [field, value] of candidates) {
        try {
          const res = await api.get(`/items/${collectionName}`, { params: { limit: 1, filter: { [field]: { _eq: value } }, fields: ['id'] } });
          const hit = res?.data?.data?.[0];
          if (hit?.id) return String(hit.id);
        } catch {}
      }
      return null;
    };

    const ensureFileAvailable = async (originalId: string): Promise<string | null> => {
      if (fileIdToNewId.has(originalId)) return fileIdToNewId.get(originalId)!;
      try {
        const exists = await api.get(`/files/${originalId}`);
        const meta = exists?.data?.data;
        if (meta?.id) {
          if (targetFolderId && meta.folder !== targetFolderId) {
            try { await api.patch(`/files/${originalId}`, { folder: targetFolderId }); } catch {}
          }
          return originalId;
        }
      } catch {}
      const entry = zipFileByOriginalId.get(originalId);
      if (!entry) return null;
      try {
        const name: string = entry.name.split('/').pop() || `${originalId}`;
        // Safety: never upload JSON control files as Directus assets
        const lower = name.toLowerCase();
        if (lower === 'items.json' || lower.endsWith('.json')) return null;
        const blob = await entry.async('blob');
        const mime = inferMimeType(name);
        const filePart: Blob = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
        const formData = new FormData();
        formData.append('file', filePart, name);
        if (targetFolderId) formData.append('folder', targetFolderId);
        const res = await api.post('/files', formData);
        const newId = res?.data?.data?.id;
        if (newId) {
          fileIdToNewId.set(originalId, String(newId));
          return String(newId);
        }
      } catch {}
      return null;
    };

    // Prepare translations from raw item for deep write
    const prepareTranslations = (raw: any): any[] | undefined => {
      const trs = raw && Array.isArray(raw.translations) ? raw.translations : undefined;
      if (!trs || trs.length === 0) return undefined;
      const cleaned = trs
        .map((t: any) => {
          if (!t) return null;
          const { id: _ignored, ...rest } = t;
          // Normalize title/body possibly being objects with value
          const normalizeRich = (v: any) =>
            typeof v === 'object' && v !== null && typeof v.value === 'string' ? v.value : v;
          const out: any = { ...rest };
          if (out.title !== undefined) out.title = normalizeRich(out.title);
          if (out.body !== undefined) out.body = normalizeRich(out.body);
          return out;
        })
        .filter(Boolean);
      return cleaned.length > 0 ? cleaned : undefined;
    };

    for (const raw of items) {
      let currentPayload: Record<string, any> | undefined = undefined;
      try {
        const { id, date_created, date_updated, user_created, user_updated, ...rest } = raw || {};
        // Remap file ids to newly uploaded ids
        const remapped = remapFileIds(rest);
        let payload = sanitizePayload(remapped);
        payload = await fillRequiredDefaults(payload);
        currentPayload = payload;
        const deepTranslations = prepareTranslations(remapped);
        if (deepTranslations) {
          // Place translations on payload; use deep=true query param for nested write
          (payload as any).translations = deepTranslations;
        }

        // Ensure file fields actually exist, fallback to uploading from ZIP entry if missing
        for (const [fieldName, fieldMeta] of fieldByName.entries()) {
          const specials: string[] = Array.isArray(fieldMeta?.meta?.special) ? fieldMeta.meta.special : [];
          const related = fieldMeta?.meta?.related_collection || fieldMeta?.related_collection;
          const isFileField = specials.includes('file') || related === 'directus_files';
          if (!isFileField) continue;
          const current = payload[fieldName];
          if (typeof current === 'string') {
            const ensured = await ensureFileAvailable(current);
            payload[fieldName] = ensured || null;
          } else if (current && typeof current === 'object' && typeof current.id === 'string') {
            const ensured = await ensureFileAvailable(current.id);
            payload[fieldName] = ensured || null;
          } else if (current != null) {
            // Coerce any non-string leftover to null for file fields
            payload[fieldName] = null;
          }
        }

        // Upsert: try find existing by heuristics
        const existingId = await tryFindExistingId(payload);
        if (existingId) {
          try {
            // On update, send deep=true to allow nested translations
            await api.patch(`/items/${collectionName}/${existingId}`, payload, { params: { deep: true } });
            updated++;
            continue;
          } catch (e: any) {
            // fallthrough to create
          }
        }

        const createRes = await api.post(`/items/${collectionName}`, payload, { params: { deep: true } });
        if (createRes?.data?.data?.id) {
          created++;
        } else {
          failed++;
          if (!firstErrorMessage) firstErrorMessage = 'Unknown validation error';
        }
      } catch (errCreate: any) {
        failed++;
        try {
          const backend = errCreate?.response?.data;
          if (!firstErrorMessage) {
            const apiMsg = backend?.errors?.[0]?.message || backend?.errors?.[0]?.extensions?.code || backend?.message;
            firstErrorMessage = apiMsg ? String(apiMsg) : (typeof backend === 'string' ? backend : errCreate?.message);
          }
          console.error('Item import failed', {
            collection: collectionName,
            error: backend || errCreate?.message,
            payload: currentPayload,
          });
        } catch {}
      }
    }

    return {
      success: true,
      message: `Imported ${created + updated} items (created: ${created}, updated: ${updated}, failed: ${failed}), files uploaded: ${filesUploaded}` + (failed > 0 && firstErrorMessage ? ` — first error: ${firstErrorMessage}` : ''),
      stats: { created, updated, failed, filesUploaded },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `ZIP import failed: ${error.message}`,
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    };
  }
}
