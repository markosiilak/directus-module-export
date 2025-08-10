<template>
  <private-view title="Import/Push Collection Data">
    <template #sidebar>
      <sidebar-detail icon="info" title="Information" close>
        <div class="page-description" />
      </sidebar-detail>
    </template>
    <div class="content-wrapper">
      <p>This module allows you to import and push collection data to/from another server.</p>
      <div>
        <div class="domain-selector">
          <div class="api-inputs">
            <div class="input-group">
              <component
                :is="domainInputMode === 'select' ? 'v-select' : 'v-input'"
                v-model="selectedDomain"
                :items="domainInputMode === 'select' ? domainHistory : undefined"
                :filter="domainInputMode === 'select' ? customFilter : undefined"
                placeholder="Enter server API URL"
                :disabled="loadingStates['import']"
                class="domain-input"
                :searchable="domainInputMode === 'select'"
                :allow-input="domainInputMode === 'select'"
                @update:model-value="handleDomainSelect" />
              <v-button small secondary icon="true" @click="toggleDomainInputMode">
                <v-icon :name="domainInputMode === 'select' ? 'edit' : 'list'" />
              </v-button>
            </div>
            <div class="input-group">
              <component
                :is="tokenInputMode === 'select' ? 'v-select' : 'v-input'"
                v-model="adminToken"
                :items="tokenInputMode === 'select' ? tokenHistory : undefined"
                :filter="tokenInputMode === 'select' ? customFilter : undefined"
                placeholder="Enter admin token"
                type="text"
                :disabled="loadingStates['import']"
                class="token-input"
                :searchable="tokenInputMode === 'select'"
                :allow-input="tokenInputMode === 'select'"
                @update:model-value="handleTokenSelect" />
              <v-button small secondary icon="true" @click="toggleTokenInputMode">
                <v-icon :name="tokenInputMode === 'select' ? 'edit' : 'list'" />
              </v-button>
            </div>
          </div>

          <v-button small secondary :loading="loadingStates['token_validation']" @click="validateToken">
            <v-icon name="verified_user" left />
            Validate Token
          </v-button>

          <v-button small secondary :loading="loadingStates['test_collections']" @click="testCollections">
            <v-icon name="bug_report" left />
            Test Collections
          </v-button>

          <div v-if="domainHistory.length > 0 || tokenHistory.length > 0" class="history-buttons">
            <v-button v-if="domainHistory.length > 0" small secondary @click="clearDomainHistory">
              <v-icon name="delete" left />
              Clear Domain History
            </v-button>
            <v-button v-if="tokenHistory.length > 0" small secondary @click="clearTokenHistory">
              <v-icon name="delete" left />
              Clear Token History
            </v-button>
          </div>
          <v-notice v-if="adminToken" type="info" class="token-info">
            Make sure your admin token has read/write permissions for the target collections
          </v-notice>
        </div>

        <div v-if="operationStatus" class="status-display" :class="operationStatus.type">
          <v-notice :type="operationStatus.type">
            Status: {{ operationStatus.status }} - {{ operationStatus.message }}
          </v-notice>
        </div>

        <div v-for="collection in collections" :key="collection.collection" class="api-buttons">
          <h2 class="title type-title uppercase">{{ collection.collection }}</h2>
          <div />
          <div class="collection-buttons">
            <v-button
              small
              warning="true"
              :loading="loadingStates[`import_${collection.collection}`]"
              :disabled="!selectedDomain || !adminToken"
              @click="importFromLive(collection.collection)">
              <v-icon name="cloud_download" left />
              Import from another Directus
            </v-button>
          </div>
        </div>
      </div>
    </div>
  </private-view>
</template>

<script lang="ts">
  import { useApi } from '@directus/extensions-sdk';
  import { defineComponent, onMounted, Ref, ref, watch } from 'vue';

  import { importFromDirectus, validateDirectusToken } from './utils/apiHandlers';

  // Type definitions
  interface ApiError {
    message?: string;
    response?: {
      data?: {
        message?: string;
        error?: string;
        details?: unknown;
        success?: boolean;
        data?: unknown;
      };
      status?: number;
    };
  }

  interface ImportLogEntry {
    timestamp: string;
    step: string;
    details: Record<string, unknown>;
  }

  interface Collection {
    collection: string;
    meta?: {
      is_folder?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  interface OperationStatus {
    status?: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }

  interface LoadingStates {
    import: boolean;
    push: boolean;
    token_validation: boolean;
    test_collections: boolean;
    [key: string]: boolean;
  }

  interface ImportedItem {
    originalId: string | number;
    newId?: string | number;
    status: 'success' | 'error';
    data?: any;
    error?: {
      message: string;
      status?: number;
      details?: any;
    };
  }

  interface ImportResult {
    success: boolean;
    message: string;
    importedItems?: ImportedItem[];
    error?: any;
    importLog?: ImportLogEntry[];
  }

  interface ValidationResult {
    success: boolean;
    message: string;
    serverInfo?: {
      version: string;
      project: string;
    };
    error?: any;
  }

  type InputMode = 'select' | 'input';

  export default defineComponent({
    name: 'ImportPushCollections',
    setup(): {
      api: any;
      collections: Ref<Collection[]>;
      loadingStates: Ref<LoadingStates>;
      selectedDomain: Ref<string>;
      adminToken: Ref<string>;
      domainHistory: Ref<string[]>;
      tokenHistory: Ref<string[]>;
      domainInputMode: Ref<InputMode>;
      tokenInputMode: Ref<InputMode>;
      needsReload: Ref<boolean>;
      operationStatus: Ref<OperationStatus | null>;
      customFilter: (item: string, queryText: string) => boolean;
      handleDomainSelect: (value: string) => void;
      handleTokenSelect: (value: string) => void;
      clearDomainHistory: () => void;
      clearTokenHistory: () => void;
      toggleDomainInputMode: () => void;
      toggleTokenInputMode: () => void;
      validateToken: () => Promise<boolean>;
      testCollections: () => Promise<void>;
      importFromLive: (collectionName: string) => Promise<void>;
      setLoading: (operation: string, collection: string, state: boolean) => void;
    } {
      const api = useApi();
      const collections = ref<Collection[]>([]);
      const loadingStates = ref<LoadingStates>({
        import: false,
        push: false,
        token_validation: false,
        test_collections: false
      });
      const selectedDomain = ref<string>(localStorage.getItem('selectedDomain') || '');
      const adminToken = ref<string>(localStorage.getItem('adminToken') || '');
      const domainHistory = ref<string[]>([]);
      const tokenHistory = ref<string[]>([]);
      const domainInputMode = ref<InputMode>((localStorage.getItem('domainInputMode') as InputMode) || 'select');
      const tokenInputMode = ref<InputMode>((localStorage.getItem('tokenInputMode') as InputMode) || 'select');
      const needsReload = ref<boolean>(false);
      const operationStatus = ref<OperationStatus | null>(null);

      // Load histories from localStorage on mount
      onMounted(async (): Promise<void> => {
        const savedDomainHistory = localStorage.getItem('domainHistory');
        const savedTokenHistory = localStorage.getItem('tokenHistory');

        if (savedDomainHistory) {
          try {
            domainHistory.value = JSON.parse(savedDomainHistory);
          } catch (e) {
            console.warn('Failed to parse domain history, starting fresh');
            domainHistory.value = [];
          }
        }

        if (savedTokenHistory) {
          try {
            tokenHistory.value = JSON.parse(savedTokenHistory);
          } catch (e) {
            console.warn('Failed to parse token history, starting fresh');
            tokenHistory.value = [];
          }
        }

        console.log(
          'Initial selectedDomain from localStorage:',
          localStorage.getItem('selectedDomain')
        );
        console.log('Current selectedDomain ref value:', selectedDomain.value);

        // Fetch collections when component mounts
        await fetchCollections();
      });

      // Custom filter for domain selection
      const customFilter = (item: string, queryText: string): boolean => {
        const text = item.toLowerCase();
        const query = queryText.toLowerCase();
        return text.indexOf(query) > -1;
      };

      // Handle domain selection
      const handleDomainSelect = (value: string): void => {
        if (value && !domainHistory.value.includes(value)) {
          domainHistory.value.unshift(value);
          // Keep only last 10 domains
          if (domainHistory.value.length > 10) {
            domainHistory.value.pop();
          }
          localStorage.setItem('domainHistory', JSON.stringify(domainHistory.value));
        }
      };

      // Handle token selection
      const handleTokenSelect = (value: string): void => {
        if (value) {
          if (!tokenHistory.value.includes(value)) {
            tokenHistory.value.unshift(value);
            if (tokenHistory.value.length > 5) {
              tokenHistory.value.pop();
            }
            localStorage.setItem('tokenHistory', JSON.stringify(tokenHistory.value));
          }
          adminToken.value = value;
        }
      };

      // Clear domain history
      const clearDomainHistory = (): void => {
        domainHistory.value = [];
        localStorage.removeItem('domainHistory');
      };

      // Clear token history
      const clearTokenHistory = (): void => {
        tokenHistory.value = [];
        localStorage.removeItem('tokenHistory');
      };

      // Toggle input modes
      const toggleDomainInputMode = (): void => {
        domainInputMode.value = domainInputMode.value === 'select' ? 'input' : 'select';
        localStorage.setItem('domainInputMode', domainInputMode.value);
      };

      const toggleTokenInputMode = (): void => {
        tokenInputMode.value = tokenInputMode.value === 'select' ? 'input' : 'select';
        localStorage.setItem('tokenInputMode', tokenInputMode.value);
      };

      // Watch for changes in selectedDomain and adminToken
      watch([selectedDomain, adminToken], ([newDomain, newToken]: [string, string]): void => {
        console.log('Saving credentials to localStorage');
        localStorage.setItem('selectedDomain', newDomain);

        if (newDomain && !domainHistory.value.includes(newDomain)) {
          domainHistory.value.unshift(newDomain);
          if (domainHistory.value.length > 10) {
            domainHistory.value.pop();
          }
          localStorage.setItem('domainHistory', JSON.stringify(domainHistory.value));
        }

        if (newToken) {
          localStorage.setItem('adminToken', newToken);
          adminToken.value = newToken;

          // Only add to history if in select mode
          if (tokenInputMode.value === 'select' && !tokenHistory.value.includes(newToken)) {
            tokenHistory.value.unshift(newToken);
            if (tokenHistory.value.length > 5) {
              tokenHistory.value.pop();
            }
            localStorage.setItem('tokenHistory', JSON.stringify(tokenHistory.value));
          }
        } else {
          localStorage.removeItem('adminToken');
        }
      });

      watch(needsReload, (value: boolean): void => {
        if (value) {
          // Use a more reliable way to reload in Directus admin context
          try {
            window.location.reload();
          } catch (error) {
            console.warn('Could not reload page automatically:', error);
            // Fallback: show a message to the user
            operationStatus.value = {
              status: 200,
              message: 'Changes applied. Please refresh the page manually if needed.',
              type: 'info'
            };
          }
        }
      });

      const setLoading = (operation: string, collection: string, state: boolean): void => {
        loadingStates.value[operation] = state;
        if (collection) {
          loadingStates.value[`${operation}_${collection}`] = state;
        }
      };

      const fetchCollections = async (): Promise<void> => {
        try {
          const response = await api.get('/collections');
          console.log('All collections:', response.data.data);

          const excludedPatterns: string[] = [
            '_translations',
            '_languages',
            '_extensions',
            '_operations',
            '_shares',
            '_fields',
            '_migrations',
            '_versions',
            '_notifications',
            '_sessions',
            '_sync_id',
          ];

          const filteredCollections = response.data.data.filter((collection: Collection): boolean => {
            const isExcluded = excludedPatterns.some((pattern: string) => collection.collection.includes(pattern));
            const isFolder = collection.meta?.is_folder;
            console.log('Collection:', collection.collection, {
              isExcluded,
              isFolder,
              meta: collection.meta
            });
            return !isExcluded && !isFolder;
          });

          console.log('Filtered collections:', filteredCollections);
          collections.value = filteredCollections;
        } catch (error) {
          console.error('Error fetching collections:', error);
        }
      };

      // removed legacy sync endpoints

      const validateToken = async (): Promise<boolean> => {
        if (!selectedDomain.value || !adminToken.value) {
          alert('Please enter both server URL and admin token');
          return false;
        }

        try {
          setLoading('token_validation', '', true);
          operationStatus.value = null;

          const token = adminToken.value;

          // Use the local validation function
          const result: ValidationResult = await validateDirectusToken(selectedDomain.value, token);

          if (result.success) {
            operationStatus.value = {
              status: 200,
              message: `Token validated successfully! Server Info: Version: ${result.serverInfo?.version || 'Unknown'}, Project: ${result.serverInfo?.project || 'Unknown'}`,
              type: 'success'
            };
            return true;
          } else {
            operationStatus.value = {
              status: 400,
              message: result.message || 'Token validation failed',
              type: 'error'
            };
            return false;
          }
        } catch (error: any) {
          console.error('Token validation error:', error);

          operationStatus.value = {
            status: 500,
            message: error.message || 'Token validation failed',
            type: 'error'
          };
          return false;
        } finally {
          setLoading('token_validation', '', false);
        }
      };

      const testCollections = async (): Promise<void> => {
        if (!selectedDomain.value || !adminToken.value) {
          alert('Please enter both server URL and admin token');
          return;
        }

        try {
          setLoading('test_collections', '', true);
          operationStatus.value = null;

          const token = adminToken.value;

          // Import the test function
          const { testMultipleCollections } = await import('./utils/apiHandlers');

          // Test multiple collections
          const result = await testMultipleCollections(selectedDomain.value, token);

          // Create a summary of results
          const successfulCollections = Object.entries(result.results)
            .filter(([_, res]) => res.success)
            .map(([name, _]) => name);

          const failedCollections = Object.entries(result.results)
            .filter(([_, res]) => !res.success)
            .map(([name, res]) => `${name}: ${res.message}`);

          let message = '';
          if (successfulCollections.length > 0) {
            message += `✅ Working collections: ${successfulCollections.join(', ')}\n\n`;
          }
          if (failedCollections.length > 0) {
            message += `❌ Failed collections:\n${failedCollections.join('\n')}`;
          }

          operationStatus.value = {
            status: result.success ? 200 : 400,
            message: message || 'No collections tested',
            type: result.success ? 'success' : 'warning'
          };

          // Log detailed results to console
          console.log('Collection test results:', result.results);
        } catch (error: any) {
          console.error('Collection test error:', error);
          operationStatus.value = {
            status: 500,
            message: error.message || 'Collection test failed',
            type: 'error'
          };
        } finally {
          setLoading('test_collections', '', false);
        }
      };

      const importFromLive = async (collectionName: string): Promise<void> => {
        if (!selectedDomain.value || !adminToken.value) {
          console.error('API URL and admin token are required for external API access');
          operationStatus.value = {
            status: 400,
            message: 'API URL and admin token are required for external API access',
            type: 'error'
          };
          return;
        }

        try {
          setLoading('import', collectionName, true);
          operationStatus.value = null;

          const token = adminToken.value;

          // Preflight: verify access to the specific collection for clearer messaging
          try {
            const { testCollectionAccess } = await import('./utils/apiHandlers');
            const access = await testCollectionAccess(selectedDomain.value, token, collectionName);
            if (!access.success) {
              operationStatus.value = {
                status: access.error?.status || 403,
                message: access.message,
                type: 'error'
              };
              alert(access.message + '\n\nTip: Ensure the token role has READ permission on the collection.');
              return;
            }
          } catch (preflightError: any) {
            console.warn('Preflight access test failed; proceeding to import', preflightError?.message);
          }

          // Use the local import function
          const result: ImportResult = await importFromDirectus(selectedDomain.value, token, collectionName, api);

          if (result.success) {
            // Calculate success/failure statistics
            const importedItems = result.importedItems || [];
            const successful = importedItems.filter((item: ImportedItem) => item.status !== 'error').length;
            const failed = importedItems.filter((item: ImportedItem) => item.status === 'error').length;

            // If the collection is empty, show a different message
            if (result.message?.includes('empty')) {
              operationStatus.value = {
                status: 200,
                message: result.message,
                type: 'info'
              };
            } else {
              operationStatus.value = {
                status: 200,
                message: `Successfully imported ${successful} items from ${collectionName} (${failed} failed)`,
                type: failed > 0 ? 'warning' : 'success'
              };
            }

            // If there were any failures, show them in the console
            if (failed > 0) {
              const failedItems = importedItems.filter((item: ImportedItem) => item.status === 'error');
              console.warn('Some items failed to import:', failedItems);
            }

            console.log('Import result:', result);
            return;
          }

          // Handle failure
          const errorMessage = result.message || `Failed to import ${collectionName}`;
          const errorDetails = result.error?.details || 'No additional details available';
          const importLog = result.importLog || [];

          // Log the full error details for debugging
          console.error('Import failed:', {
            message: errorMessage,
            details: errorDetails,
            importLog
          });

          // Find the last error in the import log if available
          const lastError = importLog.find((log: ImportLogEntry) => log.step === 'fatal_error' || log.step === 'error');
          const detailedMessage = lastError
            ? `${errorMessage} - ${JSON.stringify(lastError.details)}`
            : errorMessage;

          operationStatus.value = {
            status: 500,
            message: detailedMessage,
            type: 'error'
          };

          // Show a more detailed error alert
          alert(
            `Import failed for ${collectionName}:\n\n` +
              `Error: ${errorMessage}\n` +
              `Details: ${errorDetails}\n\n` +
              'Please check:\n' +
              '1. The server URL is correct\n' +
              '2. The collection exists on the source server\n' +
              '3. The admin token has proper permissions\n' +
              '4. The source server is accessible'
          );
        } catch (error: unknown) {
          console.error('Error importing from live server:', error);
          const apiError = error as ApiError;
          const errorMessage = apiError.message || 'Unknown error occurred';

          operationStatus.value = {
            status: 500,
            message: errorMessage,
            type: 'error'
          };

          // Show a more detailed error alert
          alert(
            `Import failed for ${collectionName}:\n\n` +
              `Error: ${errorMessage}\n\n` +
              'Please check:\n' +
              '1. The server URL is correct\n' +
              '2. The collection exists on the source server\n' +
              '3. The admin token has proper permissions\n' +
              '4. The source server is accessible'
          );
        } finally {
          setLoading('import', collectionName, false);
        }
      };

      // removed: legacy importFromApi flow

      // Return all the reactive state and methods that are used in the template
      return {
        api,
        collections,
        loadingStates,
        selectedDomain,
        adminToken,
        domainHistory,
        tokenHistory,
        domainInputMode,
        tokenInputMode,
        needsReload,
        operationStatus,
        customFilter,
        handleDomainSelect,
        handleTokenSelect,
        clearDomainHistory,
        clearTokenHistory,
        toggleDomainInputMode,
        toggleTokenInputMode,
        validateToken,
        testCollections,
        importFromLive,
        setLoading
      };
    }
  });
</script>

<style scoped>
.uppercase::first-letter {
  text-transform: uppercase;
}

.content-wrapper {
  padding-left: 40px;
  padding-right: 20px;
}

.v-notice {
  margin-top: 4px;
  margin-bottom: 4px;
}

p {
  margin-bottom: 20px;
  font-size: 16px;
  line-height: 1.5;
}

.v-button {
  margin-right: 4px;
  margin-bottom: 4px;
  margin-top: 4px;
  text-align: center;
}

.api-inputs {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: stretch;
}

.input-group {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: stretch;
}

.api-inputs>* {
  flex: 1;
}

.api-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-bottom: 20px;
}

.collection-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.api-url-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.api-url-input .v-input {
  flex: 1;
}

.domain-input {
  flex: 1;
  margin-bottom: 12px;
}

.token-input {
  flex: 1;
  margin-bottom: 12px;
}

.domain-selector {
  margin-bottom: 20px;
}

.token-info {
  margin-top: 8px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .content-wrapper {
    padding: 15px;
  }

  p {
    font-size: 14px;
  }

  .v-button {
    width: 100%;
    margin-right: 0;
  }

  .api-inputs {
    flex-direction: column;
  }

  .api-url-input .v-input,
  .domain-input,
  .token-input {
    width: 100%;
  }

  .collection-buttons {
    flex-direction: column;
  }
}

.status-display {
  margin: 12px 0;
}

.status-display.success {
  color: var(--success);
}

.status-display.error {
  color: var(--danger);
}

.status-display.warning {
  color: var(--warning);
}

.status-display.info {
  color: var(--primary);
}
</style>
