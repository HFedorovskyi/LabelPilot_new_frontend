declare const process: any;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = {
    nomenclature: {
        list: async () => {
            const res = await fetch(`${API_BASE}/nomenclature/`);
            if (!res.ok) throw new Error('Failed to fetch nomenclature');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/nomenclature/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create nomenclature');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await fetch(`${API_BASE}/nomenclature/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update nomenclature');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/nomenclature/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete nomenclature');
        },
        // Add update if needed
        sendToStations: async (stationIds: string[]) => {
            const res = await fetch(`${API_BASE}/nomenclature/send_to_stations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stations: stationIds }),
            });
            if (!res.ok) throw new Error('Failed to send to stations');
            return res.json();
        },
    },
    packs: {
        list: async () => {
            const res = await fetch(`${API_BASE}/packs/`);
            if (!res.ok) throw new Error('Failed to fetch packs');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/packs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create pack');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await fetch(`${API_BASE}/packs/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update pack');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/packs/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete pack');
        },
    },
    links: {
        list: async () => {
            const res = await fetch(`${API_BASE}/links/`);
            if (!res.ok) throw new Error('Failed to fetch links');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/links/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create link');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/links/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete link');
        },
    },

    labels: {
        list: async () => {
            const res = await fetch(`${API_BASE}/labels/`);
            if (!res.ok) throw new Error('Failed to fetch labels');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/labels/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create label');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await fetch(`${API_BASE}/labels/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update label');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/labels/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete label');
        },
    },
    stations: {
        list: async () => {
            const res = await fetch(`${API_BASE}/stations/`);
            if (!res.ok) throw new Error('Failed to fetch stations');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/stations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create station');
            return res.json();
        },
        update: async (uuid: string, data: any) => {
            const res = await fetch(`${API_BASE}/stations/${uuid}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update station');
            return res.json();
        },
        delete: async (uuid: string) => {
            const res = await fetch(`${API_BASE}/stations/${uuid}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete station');
        },
        sync: async (uuid: string) => {
            const res = await fetch(`${API_BASE}/stations/${uuid}/sync_data/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to sync data');
            }
            return res.json();
        }
    },
    attributes: {
        list: async () => {
            const res = await fetch(`${API_BASE}/attributes/`);
            if (!res.ok) throw new Error('Failed to fetch attributes');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/attributes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create attribute');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/attributes/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete attribute');
        },
    },
    barcodes: {
        list: async () => {
            const res = await fetch(`${API_BASE}/barcodes/`);
            if (!res.ok) throw new Error('Failed to fetch barcodes');
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_BASE}/barcodes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create barcode template');
            return res.json();
        },
        update: async (id: number | string, data: any) => {
            const res = await fetch(`${API_BASE}/barcodes/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update barcode template');
            return res.json();
        },
        delete: async (id: number | string) => {
            const res = await fetch(`${API_BASE}/barcodes/${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete barcode template');
        },
        generate: async (structure: any) => {
            const res = await fetch(`${API_BASE}/barcodes/generate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ barcode_structure: structure }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate barcode preview');
            }
            return res.json();
        },
    }

};
