import { LearningDocument } from '../types/document';
import { ChatMessage, SourceCitation } from '../types/chat';
import { VisionAnalysis } from '../types/vision';
import { QuizQuestion } from '../types/quiz';
import { StudyOverviewMetrics, TopicMastery, WeeklyActivityPoint } from '../types/analytics';

export const DEMO_DOCUMENTS: LearningDocument[] = [
  {
    id: 'doc-cn-unit1',
    name: 'Computer Networks — Unit 1.pdf',
    type: 'pdf',
    size: '4.8 MB',
    pages: 184,
    sectionsCount: 24,
    diagramsCount: 15,
    tablesCount: 9,
    uploadedAt: 'Sep 18, 2026',
    status: 'ready',
    topicCategory: 'Architecture & OSI Model',
    description: 'Layered architecture, OSI 7-layer model, TCP/IP stack fundamentals, physical and data-link protocols.',
    chunks: [
      {
        id: 'chunk-cn1-1',
        documentId: 'doc-cn-unit1',
        documentName: 'Computer Networks — Unit 1.pdf',
        page: 14,
        section: '1.3 Layering Principles',
        content: 'The Open Systems Interconnection (OSI) reference model partitions network communication into seven distinct conceptual layers: Physical, Data Link, Network, Transport, Session, Presentation, and Application. Each layer provides services to the layer above it while concealing implementation complexity.',
        relevanceScore: 0.91
      }
    ]
  },
  {
    id: 'doc-cn-transport',
    name: 'Computer Networks — Transport Layer.pdf',
    type: 'pdf',
    size: '6.2 MB',
    pages: 248,
    sectionsCount: 32,
    diagramsCount: 18,
    tablesCount: 12,
    uploadedAt: 'Sep 19, 2026',
    status: 'ready',
    topicCategory: 'Transport Layer Protocols',
    description: 'In-depth coverage of Transmission Control Protocol (TCP), User Datagram Protocol (UDP), connection management, flow control, and AIMD congestion control.',
    chunks: [
      {
        id: 'chunk-cnt-42',
        documentId: 'doc-cn-transport',
        documentName: 'Computer Networks — Transport Layer.pdf',
        page: 42,
        section: '3.4 TCP vs. UDP Protocol Mechanics',
        content: 'TCP (Transmission Control Protocol) is a connection-oriented, full-duplex protocol that provides reliable, in-order byte-stream delivery. It incorporates sequence numbers, cumulative acknowledgments, checksum verification, sliding window flow control, and adaptive congestion avoidance algorithms (Slow Start, Congestion Avoidance, Fast Retransmit). In contrast, UDP (User Datagram Protocol) is a lightweight, connectionless datagram service that provides no delivery guarantee, no ordering guarantee, and no congestion control, resulting in minimal protocol overhead (8-byte header vs TCP minimum 20-byte header).',
        relevanceScore: 0.95
      },
      {
        id: 'chunk-cnt-58',
        documentId: 'doc-cn-transport',
        documentName: 'Computer Networks — Transport Layer.pdf',
        page: 58,
        section: '3.5.2 Three-Way Handshake Connection Establishment',
        content: 'TCP establishes an active connection using a three-way handshake procedure before application data transmission begins: (1) The client initiates with a SYN segment containing an initial sequence number (ISN_c). (2) The server responds with a SYN-ACK segment acknowledging ISN_c + 1 and providing its own sequence number (ISN_s). (3) The client finalizes by sending an ACK acknowledging ISN_s + 1. Both endpoints transition to the ESTABLISHED state.',
        relevanceScore: 0.93
      },
      {
        id: 'chunk-cnt-84',
        documentId: 'doc-cn-transport',
        documentName: 'Computer Networks — Transport Layer.pdf',
        page: 84,
        section: '3.7 Congestion Control Mechanisms',
        content: 'TCP congestion control employs Additive Increase Multiplicative Decrease (AIMD). The congestion window (cwnd) increases linearly by 1 MSS per RTT during congestion avoidance and halves upon detecting packet loss via triple duplicate ACKs. If a retransmission timeout (RTO) occurs, cwnd drops to 1 MSS, reverting to Slow Start.',
        relevanceScore: 0.89
      }
    ]
  },
  {
    id: 'doc-tcp-notes',
    name: 'TCP/IP Reference Notes.pdf',
    type: 'notes',
    size: '2.1 MB',
    pages: 64,
    sectionsCount: 14,
    diagramsCount: 8,
    tablesCount: 6,
    uploadedAt: 'Sep 20, 2026',
    status: 'ready',
    topicCategory: 'Protocol Reference',
    description: 'Handwritten and typed lecture notes summarizing transport layer states, flags (SYN, ACK, FIN, RST, PSH, URG), and socket lifecycle.',
    chunks: [
      {
        id: 'chunk-tcpn-8',
        documentId: 'doc-tcp-notes',
        documentName: 'TCP/IP Reference Notes.pdf',
        page: 8,
        section: 'Summary: Transport Layer Tradeoffs',
        content: 'Real-time media streaming, VoIP, DNS queries, and multiplayer game telemetry prefer UDP because late packets are useless and retransmission creates unacceptable latency. Web browsing (HTTP/1.1 and HTTP/2), file transfers (FTP/SFTP), SSH, and email (SMTP) mandate TCP because silent packet dropping corrupts payloads.',
        relevanceScore: 0.92
      }
    ]
  },
  {
    id: 'doc-netsec-unit5',
    name: 'Network Security — Unit 5.pdf',
    type: 'pdf',
    size: '5.1 MB',
    pages: 152,
    sectionsCount: 20,
    diagramsCount: 11,
    tablesCount: 8,
    uploadedAt: 'Sep 20, 2026',
    status: 'ready',
    topicCategory: 'Security & TLS',
    description: 'Transport Layer Security (TLS 1.3), cryptographic handshakes, symmetric cipher suites, and defense against SYN flood attacks.',
    chunks: [
      {
        id: 'chunk-sec-29',
        documentId: 'doc-netsec-unit5',
        documentName: 'Network Security — Unit 5.pdf',
        page: 29,
        section: '5.2 SYN Flood and TCP SYN Cookies',
        content: 'A SYN flood attack exploits TCP state allocation by sending rapid SYN packets without completing the third ACK, exhausting the server backlog queue. Modern operating systems defend using SYN Cookies, encoding state into the initial sequence number rather than allocating kernel memory prior to handshake completion.',
        relevanceScore: 0.86
      }
    ]
  }
];

export const DEMO_PRESET_CONVERSATION: ChatMessage[] = [
  {
    id: 'msg-initial-1',
    role: 'user',
    content: 'What is the difference between TCP and UDP?',
    timestamp: '10:42 AM'
  },
  {
    id: 'msg-initial-2',
    role: 'assistant',
    content: '',
    timestamp: '10:42 AM',
    capabilities: ['RAG GROUNDED', 'GENERATIVE AI'],
    structuredAnswer: {
      shortAnswer: 'TCP (Transmission Control Protocol) is connection-oriented and provides reliable, guaranteed in-order byte-stream delivery with flow and congestion control. UDP (User Datagram Protocol) is connectionless and delivers lightweight, best-effort datagrams with minimal overhead and no delivery guarantees.',
      keyDifferences: {
        headerA: 'TCP (Transmission Control Protocol)',
        headerB: 'UDP (User Datagram Protocol)',
        rows: [
          { feature: 'Connection Model', colA: 'Connection-oriented (Requires 3-Way Handshake)', colB: 'Connectionless (Sends datagrams immediately)' },
          { feature: 'Delivery Reliability', colA: 'Guaranteed delivery with retransmissions', colB: 'Best-effort delivery (Packets may be dropped)' },
          { feature: 'Packet Ordering', colA: 'Strict in-order sequencing via sequence numbers', colB: 'No ordering guarantee (Packets may arrive out of order)' },
          { feature: 'Header Size Overhead', colA: '20 to 60 bytes (flags, checksum, window size)', colB: '8 bytes fixed (Source/Dest Port, Length, Checksum)' },
          { feature: 'Flow & Congestion Control', colA: 'Sliding window flow control + AIMD congestion control', colB: 'None (Transmits at application data rate)' },
          { feature: 'Typical Use Cases', colA: 'Web (HTTP/HTTPS), File Transfer (SFTP), Email, SSH', colB: 'Video Streaming, VoIP, DNS, Multiplayer Gaming, NTP' }
        ]
      },
      inSimpleTerms: 'TCP is like sending a tracked courier parcel with registered signature required: if it goes missing, they locate it and re-deliver until confirmed. UDP is like mailing a postcard: it drops into the post box instantly with zero setup, but if rain ruins it or it gets lost, there is no automatic replacement.',
      keyTakeaways: [
        'Use TCP when data accuracy and completeness are strictly mandatory.',
        'Use UDP when real-time timeliness matters more than occasional lost packets.'
      ]
    },
    sources: [
      {
        id: 'source-1',
        documentId: 'doc-cn-transport',
        documentName: 'Computer Networks — Transport Layer.pdf',
        page: 42,
        section: '3.4 TCP vs. UDP Protocol Mechanics',
        excerpt: 'TCP (Transmission Control Protocol) is a connection-oriented, full-duplex protocol that provides reliable, in-order byte-stream delivery. It incorporates sequence numbers, cumulative acknowledgments, checksum verification, sliding window flow control... In contrast, UDP is a lightweight, connectionless datagram service that provides no delivery guarantee, resulting in minimal protocol overhead (8-byte header vs 20-byte minimum header).',
        relevance: 0.95
      },
      {
        id: 'source-2',
        documentId: 'doc-tcp-notes',
        documentName: 'TCP/IP Reference Notes.pdf',
        page: 8,
        section: 'Summary: Transport Layer Tradeoffs',
        excerpt: 'Real-time media streaming, VoIP, DNS queries, and multiplayer game telemetry prefer UDP because late packets are useless and retransmission creates unacceptable latency. Web browsing (HTTP/1.1 and HTTP/2), file transfers (FTP/SFTP), SSH, and email (SMTP) mandate TCP because silent packet dropping corrupts payloads.',
        relevance: 0.92
      }
    ],
    suggestedFollowUps: [
      'Explain the TCP three-way handshake',
      'What is congestion control in TCP?',
      'Why does DNS use UDP instead of TCP?',
      'Quiz me on TCP vs UDP'
    ]
  }
];

export const DEMO_VISION_ANALYSIS: VisionAnalysis = {
  id: 'vision-tcp-handshake',
  title: 'TCP Three-Way Handshake (Connection Establishment)',
  imageUrl: 'tcp-handshake-diagram',
  capabilities: ['VISION', 'GENERATIVE AI'],
  whatISee: 'A dual-timeline protocol exchange diagram illustrating the three-step TCP connection establishment sequence between a Client host (Initiator) and a Server host (Listener). The vertical axes depict time progression from top to bottom, labeled with state transitions and segment packet flags.',
  keyConcepts: [
    'SYN (Synchronize Sequence Numbers)',
    'SYN-ACK (Synchronize + Acknowledgment)',
    'ACK (Acknowledgment)',
    'Client Initiator',
    'Server Listener',
    'Initial Sequence Numbers (ISN)'
  ],
  stepByStep: [
    {
      stepNumber: 1,
      title: 'Step 1: SYN Segment Sent',
      description: 'The Client initiates connection by transmitting a SYN segment with SYN=1, ACK=0. It selects a random Initial Sequence Number (e.g. Seq = 1000). The client transitions from CLOSED to SYN_SENT state.',
      senderReceiver: 'Client → Server'
    },
    {
      stepNumber: 2,
      title: 'Step 2: SYN-ACK Segment Response',
      description: 'The Server receives the SYN, allocates connection buffers, and responds with a SYN-ACK segment (SYN=1, ACK=1). It sets Ack = 1001 (Client Seq + 1) and generates its own sequence number (e.g. Seq = 5000). The server transitions from LISTEN to SYN_RECEIVED state.',
      senderReceiver: 'Server → Client'
    },
    {
      stepNumber: 3,
      title: 'Step 3: Final ACK Segment Confirmation',
      description: 'The Client receives the SYN-ACK and replies with a final ACK segment (ACK=1, SYN=0) with Ack = 5001 (Server Seq + 1). Client transitions to ESTABLISHED state. Upon receipt, Server also transitions to ESTABLISHED state. Application data can now piggyback.',
      senderReceiver: 'Client → Server'
    }
  ],
  detailedExplanation: 'The three-way handshake solves the fundamental problem of establishing mutually synchronized sequence numbers across an unreliable transmission medium. A two-way handshake would be inadequate because delayed duplicate SYN packets from old terminated sessions could trick a server into allocating resources for phantom connections. Step 3 ensures both parties have confirmed bidirectional transmission readiness.',
  importantLabels: [
    { tag: 'SYN Flag', description: 'Synchronize control bit in TCP header used to initiate a connection', category: 'flag' },
    { tag: 'ACK Flag', description: 'Acknowledgment bit indicating the acknowledgment field is valid', category: 'flag' },
    { tag: 'ISN (Initial Seq Number)', description: 'Cryptographically pseudorandom initial sequence number', category: 'concept' },
    { tag: 'SYN_SENT', description: 'Client state waiting for matching connection request after sending SYN', category: 'state' },
    { tag: 'SYN_RECEIVED', description: 'Server state waiting for confirming connection acknowledgment', category: 'state' },
    { tag: 'ESTABLISHED', description: 'Active open connection ready for bidirectional data byte stream', category: 'state' },
    { tag: 'Piggybacking', description: 'ACK in Step 3 can carry application payload (e.g., HTTP GET)', category: 'concept' }
  ],
  boundingBoxes: [
    { id: 'b1', label: 'SYN Step 1', x: 15, y: 18, width: 70, height: 18, description: 'Client sends SYN, Seq=x' },
    { id: 'b2', label: 'SYN-ACK Step 2', x: 15, y: 44, width: 70, height: 20, description: 'Server replies SYN-ACK, Seq=y, Ack=x+1' },
    { id: 'b3', label: 'ACK Step 3', x: 15, y: 72, width: 70, height: 18, description: 'Client sends ACK, Ack=y+1, enters ESTABLISHED' }
  ],
  relatedDocumentSource: {
    documentName: 'Computer Networks — Transport Layer.pdf',
    page: 58
  }
};

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    questionNumber: 1,
    prompt: 'Which protocol provides reliable, connection-oriented byte-stream delivery with flow and congestion control?',
    type: 'MCQ',
    options: ['UDP (User Datagram Protocol)', 'IP (Internet Protocol)', 'TCP (Transmission Control Protocol)', 'ARP (Address Resolution Protocol)'],
    correctAnswerIndex: 2,
    explanation: 'TCP establishes an end-to-end connection before transmitting and guarantees reliable in-order byte delivery with retransmissions and flow control.',
    sourceReference: {
      documentName: 'Computer Networks — Transport Layer.pdf',
      page: 42,
      topic: 'TCP Mechanics'
    }
  },
  {
    id: 'q2',
    questionNumber: 2,
    prompt: 'What flags are set during the second step of the TCP Three-Way Handshake?',
    type: 'MCQ',
    options: ['SYN = 1, ACK = 0', 'SYN = 1, ACK = 1', 'FIN = 1, ACK = 1', 'RST = 1, ACK = 0'],
    correctAnswerIndex: 1,
    explanation: 'In step 2, the server synchronizes its own sequence number while simultaneously acknowledging the client sequence number, thus asserting both SYN and ACK bits.',
    sourceReference: {
      documentName: 'Computer Networks — Transport Layer.pdf',
      page: 58,
      topic: 'Three-Way Handshake'
    }
  },
  {
    id: 'q3',
    questionNumber: 3,
    prompt: 'What is the default header size of a standard User Datagram Protocol (UDP) packet?',
    type: 'MCQ',
    options: ['20 bytes', '8 bytes', '32 bytes', '64 bytes'],
    correctAnswerIndex: 1,
    explanation: 'UDP has a minimal 8-byte header consisting of four 2-byte fields: Source Port, Destination Port, Length, and Checksum.',
    sourceReference: {
      documentName: 'Computer Networks — Transport Layer.pdf',
      page: 44,
      topic: 'UDP Header Format'
    }
  },
  {
    id: 'q4',
    questionNumber: 4,
    prompt: 'Under TCP AIMD congestion control, what happens to the congestion window (cwnd) when a packet loss is detected via triple duplicate ACKs?',
    type: 'MCQ',
    options: ['cwnd drops to 1 MSS immediately', 'cwnd is cut in half (Multiplicative Decrease)', 'cwnd increases additively by 1 MSS', 'cwnd is doubled'],
    correctAnswerIndex: 1,
    explanation: 'Triple duplicate ACKs indicate mild network congestion (Fast Recovery), so TCP halves cwnd (Multiplicative Decrease) rather than dropping all the way to 1 MSS.',
    sourceReference: {
      documentName: 'Computer Networks — Transport Layer.pdf',
      page: 84,
      topic: 'Congestion Control'
    }
  },
  {
    id: 'q5',
    questionNumber: 5,
    prompt: 'Why does DNS primarily use UDP on port 53 for standard name resolution queries?',
    type: 'MCQ',
    options: ['UDP provides cryptographic encryption for DNS', 'To avoid 3-way handshake round-trip latency and minimize server connection state', 'Because DNS packets are always larger than 1500 bytes', 'TCP is incapable of resolving domain names'],
    correctAnswerIndex: 1,
    explanation: 'Standard DNS queries fit in a single request-response packet. UDP avoids the 1-RTT handshake delay and does not require DNS root servers to maintain connection state for millions of clients.',
    sourceReference: {
      documentName: 'TCP/IP Reference Notes.pdf',
      page: 8,
      topic: 'Transport Layer Tradeoffs'
    }
  }
];

export const DEMO_STUDY_METRICS: StudyOverviewMetrics = {
  questionsAsked: 128,
  documentsIndexed: 4,
  quizzesCompleted: 8,
  averageQuizScore: 84,
  topicsMastered: 6,
  studyHoursThisWeek: 14.5
};

export const DEMO_TOPIC_MASTERY: TopicMastery[] = [
  { topic: 'Transport Layer (TCP / UDP)', category: 'Computer Networks', masteryPercentage: 88, quizzesTaken: 5, status: 'Mastered' },
  { topic: 'OSI 7-Layer Model', category: 'Computer Networks', masteryPercentage: 92, quizzesTaken: 4, status: 'Mastered' },
  { topic: 'Congestion Control & AIMD', category: 'Computer Networks', masteryPercentage: 68, quizzesTaken: 3, status: 'Needs Review' },
  { topic: 'Network Security & TLS', category: 'Security', masteryPercentage: 74, quizzesTaken: 2, status: 'In Progress' },
  { topic: 'IP Addressing & Subnetting', category: 'Network Layer', masteryPercentage: 85, quizzesTaken: 4, status: 'Mastered' }
];

export const DEMO_WEEKLY_ACTIVITY: WeeklyActivityPoint[] = [
  { day: 'Mon', questions: 18, quizzes: 1 },
  { day: 'Tue', questions: 24, quizzes: 2 },
  { day: 'Wed', questions: 12, quizzes: 0 },
  { day: 'Thu', questions: 31, quizzes: 2 },
  { day: 'Fri', questions: 15, quizzes: 1 },
  { day: 'Sat', questions: 9, quizzes: 1 },
  { day: 'Sun', questions: 19, quizzes: 1 }
];
