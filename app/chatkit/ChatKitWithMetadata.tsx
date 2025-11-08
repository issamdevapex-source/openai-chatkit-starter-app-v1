'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface PropertyMetadata {
  property_type?: string;
  developer_full_name?: string;
  location?: string;
  final_investment_verdict?: string;
  price?: number;
  currency?: string;
  surface_area_sqft?: number;
  price_per_sqft?: number;
  overall_investment_score?: number;
  market_demand_rate?: number;
  market_supply_rate?: number;
  liquidity_score?: number;
  liquidity_period_month?: number;
  location_score?: number;
  roi_rental_yield_score?: number;
  price_accuracy_score?: number;
  demand_vacancy_risk_score?: number;
  developer_trust_index?: number;
  physical_condition_score?: number;
  legal_clarity_score?: number;
  completion_status?: string;
  handover_quarter?: string;
  opportunities_summary?: string;
  risks_summary?: string;
}

export default function ChatKitWithMetadata() {
  const searchParams = useSearchParams();
  const [metadata, setMetadata] = useState<PropertyMetadata | null>(null);
  const [contextMessage, setContextMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Récupérer les metadata depuis l'URL
    const metadataParam = searchParams.get('metadata');
    
    if (metadataParam) {
      try {
        // Décoder depuis base64
        const decodedMetadata = atob(metadataParam);
        const parsedMetadata = JSON.parse(decodedMetadata) as PropertyMetadata;
        setMetadata(parsedMetadata);
        
        // Formater le message de contexte
        const formattedContext = formatMetadataAsContext(parsedMetadata);
        setContextMessage(formattedContext);
        
        console.log('[ChatKit] Metadata reçues:', parsedMetadata);
        console.log('[ChatKit] Contexte formaté:', formattedContext);
      } catch (error) {
        console.error('[ChatKit] Erreur parsing metadata:', error);
        setError('Erreur lors du chargement des données');
      }
    } else {
      setError('Aucune métadonnée fournie');
    }
  }, [searchParams]);

  // Injecter le script ChatKit et initialiser
  useEffect(() => {
    if (!metadata || !contextMessage) return;

    const initializeChatKit = async () => {
      try {
        // 1. Créer une session
        console.log('[ChatKit] Création de la session...');
        const response = await fetch('/api/create-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflow: {
              id: 'wf_68ea221f2b5481909938782b21152bce01c4d69ad5a86897'
            },
            chatkit_configuration: {
              file_upload: {
                enabled: true
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur session: ${response.statusText}`);
        }

        const sessionData = await response.json();
        console.log('[ChatKit] Session créée:', sessionData);

        // 2. Charger le widget ChatKit
        const chatKitScript = document.createElement('script');
        chatKitScript.src = 'https://cdn.openai.com/chatkit/chatkit.js';
        chatKitScript.async = true;
        
        chatKitScript.onload = () => {
          console.log('[ChatKit] Script chargé, initialisation du widget...');
          
          // @ts-ignore - ChatKit est chargé globalement
          if (window.ChatKit) {
            // @ts-ignore
            const chatkit = window.ChatKit.create({
              clientSecret: sessionData.client_secret,
              container: document.getElementById('chatkit-container'),
              initialMessage: contextMessage, // Injecter le contexte ici
              onReady: () => {
                console.log('[ChatKit] Widget prêt avec contexte injecté');
              },
              onError: (err: Error) => {
                console.error('[ChatKit] Erreur widget:', err);
                setError('Erreur lors du chargement du chat');
              }
            });
          }
        };

        chatKitScript.onerror = () => {
          setError('Erreur lors du chargement du script ChatKit');
        };

        document.body.appendChild(chatKitScript);

        return () => {
          if (chatKitScript.parentNode) {
            chatKitScript.parentNode.removeChild(chatKitScript);
          }
        };

      } catch (error) {
        console.error('[ChatKit] Erreur initialisation:', error);
        setError('Erreur lors de l\'initialisation du chat');
      }
    };

    initializeChatKit();
  }, [metadata, contextMessage]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px'
      }}>
        <div style={{ fontSize: '24px', color: '#d32f2f' }}>⚠️</div>
        <div style={{ fontSize: '18px', color: '#666' }}>{error}</div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Vérifiez que les metadata sont correctement encodées dans l'URL
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Chargement des données...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <div id="chatkit-container" style={{ width: '100%', height: '100%' }}></div>
    </div>
  );
}

/**
 * Formate les metadata en un message contexte structuré
 */
function formatMetadataAsContext(metadata: PropertyMetadata): string {
  return `📊 CONTEXTE DE L'INVESTISSEMENT IMMOBILIER

🏢 Informations générales
• Type de bien : ${metadata.property_type || 'N/A'}
• Promoteur : ${metadata.developer_full_name || 'N/A'}
• Localisation : ${metadata.location || 'N/A'}
• Statut : ${metadata.completion_status || 'N/A'}
• Date de livraison : ${metadata.handover_quarter || 'N/A'}

💰 Données financières
• Prix : ${metadata.price?.toLocaleString() || 'N/A'} ${metadata.currency || ''}
• Surface : ${metadata.surface_area_sqft || 'N/A'} pieds²
• Prix par pied² : ${metadata.price_per_sqft || 'N/A'} ${metadata.currency || ''}
• Rendement locatif : ${metadata.roi_rental_yield_score || 'N/A'}%

📈 Scores d'évaluation
• Score global d'investissement : ${metadata.overall_investment_score || 'N/A'}/100
• Score de localisation : ${metadata.location_score || 'N/A'}/100
• Score de liquidité : ${metadata.liquidity_score || 'N/A'}/100
• Période de liquidité : ${metadata.liquidity_period_month || 'N/A'} mois
• Indice de confiance promoteur : ${metadata.developer_trust_index || 'N/A'}/100
• État physique : ${metadata.physical_condition_score || 'N/A'}/100
• Clarté juridique : ${metadata.legal_clarity_score || 'N/A'}/100

📊 Analyse du marché
• Taux de demande : ${metadata.market_demand_rate ? (metadata.market_demand_rate * 100).toFixed(0) : 'N/A'}%
• Taux d'offre : ${metadata.market_supply_rate ? (metadata.market_supply_rate * 100).toFixed(0) : 'N/A'}%
• Risque de vacance : ${metadata.demand_vacancy_risk_score || 'N/A'}/100
• Précision du prix : ${metadata.price_accuracy_score || 'N/A'}/100

✅ Opportunités
${metadata.opportunities_summary || 'Non spécifié'}

⚠️ Risques
${metadata.risks_summary || 'Non spécifié'}

🎯 Verdict d'investissement : ${metadata.final_investment_verdict?.toUpperCase() || 'N/A'}

---

Je dispose de toutes ces informations pour répondre à vos questions sur cet investissement immobilier.`;
}
